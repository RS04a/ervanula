import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createPaymentsApp } from "../../apps/payments-service/src/main";
import {
  createGatewayApp,
  PaymentsHttpClient,
} from "../../apps/api-gateway/src/main";
import { PrismaPaymentRepositories } from "../../apps/payments-service/src/infrastructure/database/prisma.repositories";
import { BlockchainProviderProxy } from "../../apps/payments-service/src/infrastructure/blockchain/provider.proxy";
import { AppConfig } from "../../apps/payments-service/src/infrastructure/config/config";
const input = {
  saleId: "E2E",
  merchantId: "E2E",
  recipientAddress: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
  amount: "10.00",
};
test("Gateway → Payments → Prisma/MySQL: flujo, errores, evidencia, singleton y Swagger", async () => {
  const payments = await createPaymentsApp();
  await payments.listen(0, "127.0.0.1");
  process.env.PAYMENTS_SERVICE_URL = await payments.getUrl();
  const gateway = await createGatewayApp();
  await gateway.init();
  const http = request(gateway.getHttpServer());
  assert.strictEqual(
    gateway.get(PaymentsHttpClient),
    gateway.get(PaymentsHttpClient),
  );
  const repo = payments.get(PrismaPaymentRepositories);
  const ids: string[] = [];
  try {
    assert.strictEqual(payments.get(AppConfig), payments.get(AppConfig));
    assert.strictEqual(
      payments.get(BlockchainProviderProxy),
      payments.get(BlockchainProviderProxy),
    );
    await http.get("/api/health").expect(200);
    await http.get("/docs-json").expect(200);
    await http.get("/docs-yaml").expect(200);
    const invalid = await http
      .post("/api/payments/orders")
      .send({ ...input, amount: 10 })
      .expect(400);
    assert.equal(invalid.body.error.code, "INVALID_REQUEST");
    assert.ok(invalid.body.requestId);
    const make = async () => {
      const response = await http
        .post("/api/payments/orders")
        .set("x-request-id", "e2e-trace")
        .send(input)
        .expect(201);
      ids.push(response.body.id);
      assert.equal(response.headers["x-request-id"], "e2e-trace");
      return response.body.id as string;
    };
    const id = await make();
    const hash = `demo:multi:e2e-${Date.now()}`;
    const valid = await http
      .post(`/api/payments/orders/${id}/verify`)
      .send({ transactionHash: hash })
      .expect(201);
    assert.equal(valid.body.status, "CONFIRMED");
    assert.ok(await repo.find("mainnet", hash));
    await http.get(`/api/payments/orders/${id}`).expect(200);
    const audit = await http
      .get(`/api/payments/orders/${id}/audit`)
      .expect(200);
    assert.deepEqual(
      audit.body.map((e: { newStatus: string }) => e.newStatus),
      ["PENDING", "DETECTED", "CONFIRMED"],
    );
    const second = await make();
    const duplicate = await http
      .post(`/api/payments/orders/${second}/verify`)
      .send({ transactionHash: hash })
      .expect(409);
    assert.equal(duplicate.body.error.code, "DUPLICATE_TRANSACTION");
    const outage = await http
      .post(`/api/payments/orders/${second}/verify`)
      .send({ transactionHash: "demo:unavailable:e2e" })
      .expect(503);
    assert.equal(outage.body.error.retryable, true);
    assert.equal((await repo.get(second))?.status, "PENDING");
    const rejected = await http
      .post(`/api/payments/orders/${second}/verify`)
      .send({ transactionHash: "demo:recipient:e2e" })
      .expect(422);
    assert.equal(rejected.body.error.code, "WRONG_RECIPIENT");
    assert.equal((await repo.get(second))?.status, "REJECTED");
    assert.ok(await repo.find("mainnet", "demo:recipient:e2e"));
    const concurrentIds = await Promise.all([make(), make()]);
    const concurrentHash = `demo:valid:race-${Date.now()}`;
    const responses = await Promise.all(
      concurrentIds.map((i) =>
        http
          .post(`/api/payments/orders/${i}/verify`)
          .send({ transactionHash: concurrentHash }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    await repo.client.blockchainTransaction.deleteMany({
      where: {
        transactionHash: { in: [hash, concurrentHash, "demo:recipient:e2e"] },
      },
    });
  } finally {
    await repo.client.paymentAuditEvent.deleteMany({
      where: { paymentOrderId: { in: ids } },
    });
    await repo.client.paymentOrder.deleteMany({ where: { id: { in: ids } } });
    await gateway.close();
    await payments.close();
  }
});

test("Gateway normaliza indisponibilidad de Payments sin exponer detalles", async () => {
  const old = process.env.PAYMENTS_SERVICE_URL;
  process.env.PAYMENTS_SERVICE_URL = "http://127.0.0.1:1";
  const gateway = await createGatewayApp();
  try {
    await gateway.init();
    const result = await request(gateway.getHttpServer())
      .get("/api/health")
      .set("x-request-id", "offline-test")
      .expect(503);
    assert.equal(result.body.error.code, "COMMUNICATION_ERROR");
    assert.equal(result.body.error.retryable, true);
    assert.equal(result.body.requestId, "offline-test");
  } finally {
    process.env.PAYMENTS_SERVICE_URL = old;
    await gateway.close();
  }
});
