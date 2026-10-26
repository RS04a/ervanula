import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createPaymentsApp } from "../../apps/payments-service/src/main";
import { createGatewayApp } from "../../apps/api-gateway/src/main";
import { PrismaPaymentRepositories } from "../../apps/payments-service/src/infrastructure/database/prisma.repositories";
import {
  tronFixture,
  fixtureHttp,
  CONTRACT,
  RECIPIENT,
} from "../support/trongrid.fixture";
test("Gateway → Payments → TronGrid fixtures HTTP: DI, solidificación, evidencia SQL, idempotencia y 401 recuperable", async () => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch;
  const fixture = tronFixture();
  const hash = randomBytes(32).toString("hex");
  fixture.body.txID = hash;
  fixture.receipt.id = hash;
  fixture.solid = structuredClone(fixture.receipt);
  const upstream = fixtureHttp(fixture);
  let status = 200;
  process.env.PAYMENT_PROVIDER = "trongrid";
  process.env.TRON_NETWORK = "mainnet";
  process.env.TRONGRID_BASE_URL = "https://api.trongrid.io";
  process.env.USDT_CONTRACT_ADDRESS = CONTRACT;
  process.env.TRC20_TOKEN_CONTRACT = CONTRACT;
  process.env.TRON_MIN_CONFIRMATIONS = "1";
  process.env.TRONGRID_API_KEY = "fixture-only-placeholder";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://api.trongrid.io/"))
      return status === 200
        ? upstream.http(input, init)
        : new Response("{}", { status });
    if (new URL(url).hostname !== "127.0.0.1")
      throw new Error("Unexpected network access in fixture test");
    return originalFetch(input, init);
  };
  let payments: Awaited<ReturnType<typeof createPaymentsApp>> | undefined;
  let gateway: Awaited<ReturnType<typeof createGatewayApp>> | undefined;
  const ids: string[] = [];
  try {
    payments = await createPaymentsApp();
    await payments.listen(0, "127.0.0.1");
    process.env.PAYMENTS_SERVICE_URL = await payments.getUrl();
    gateway = await createGatewayApp();
    await gateway.init();
    const http = request(gateway.getHttpServer());
    const repo = payments.get(PrismaPaymentRepositories);
    const make = async () => {
      const response = await http
        .post("/api/payments/orders")
        .send({
          saleId: "TRONGRID-E2E",
          merchantId: "FIXTURE",
          recipientAddress: RECIPIENT,
          amount: "10.00",
        })
        .expect(201);
      ids.push(response.body.id);
      return response.body.id as string;
    };
    const id = await make();
    fixture.receipt.blockTimeStamp = Date.now();
    fixture.solid = {};
    const pending = await http
      .post(`/api/payments/orders/${id}/verify`)
      .send({ transactionHash: hash })
      .expect(201);
    assert.equal(pending.body.status, "CONFIRMING");
    assert.equal(pending.body.failureCode, "INSUFFICIENT_CONFIRMATIONS");
    fixture.solid = structuredClone(fixture.receipt);
    const confirmed = await http
      .post(`/api/payments/orders/${id}/verify`)
      .send({ transactionHash: hash })
      .expect(201);
    assert.equal(confirmed.body.status, "CONFIRMED");
    const evidence = await repo.find("mainnet", hash);
    assert.ok(evidence?.confirmed);
    assert.ok(
      !JSON.stringify(evidence?.rawPayload).includes(
        "fixture-only-placeholder",
      ),
    );
    const calls = upstream.requests.length;
    await http
      .post(`/api/payments/orders/${id}/verify`)
      .send({ transactionHash: hash.toUpperCase() })
      .expect(201);
    assert.equal(upstream.requests.length, calls);
    const audit = await http
      .get(`/api/payments/orders/${id}/audit`)
      .expect(200);
    assert.deepEqual(
      audit.body.map((e: { newStatus: string }) => e.newStatus),
      ["PENDING", "DETECTED", "CONFIRMING", "CONFIRMED"],
    );
    const second = await make();
    await http
      .post(`/api/payments/orders/${second}/verify`)
      .send({ transactionHash: hash })
      .expect(409);
    status = 401;
    const unavailable = await http
      .post(`/api/payments/orders/${second}/verify`)
      .send({ transactionHash: "cd".repeat(32) })
      .expect(503);
    assert.equal(unavailable.body.error.code, "PROVIDER_UNAVAILABLE");
    assert.equal(unavailable.body.error.retryable, false);
    assert.equal((await repo.get(second))?.status, "PENDING");
  } finally {
    if (payments) {
      const repo = payments.get(PrismaPaymentRepositories);
      await repo.client.paymentAuditEvent.deleteMany({
        where: { paymentOrderId: { in: ids } },
      });
      await repo.client.paymentOrder.deleteMany({ where: { id: { in: ids } } });
      await repo.client.blockchainTransaction.deleteMany({
        where: { network: "mainnet", transactionHash: hash },
      });
    }
    await gateway?.close();
    await payments?.close();
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env))
      if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
