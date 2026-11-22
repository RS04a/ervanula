import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import amqp, { type ConfirmChannel } from "amqplib";
import { PrismaClient as PaymentsDb } from "@prisma/client";
import { PrismaClient as SalesDb } from "@arveluna/sales-db";
import { PrismaClient as CashDb } from "@arveluna/cash-db";
import { createPaymentsApp } from "../../apps/payments-service/src/main";
import { PrismaClient as InventoryDb } from "@arveluna/inventory-db";
import { Sales } from "../../apps/sales-service/src/application/sales";
import { PrismaSales } from "../../apps/sales-service/src/infrastructure/prisma";
import { HttpSaleOperations } from "../../apps/sales-service/src/infrastructure/operations";
import { fault } from "../../libs/full-app/contract";
import type { Event } from "../../libs/full-app/events";
import { merchantFixture, validateTestProfile } from "./fixtures";

const gateway = "http://127.0.0.1:13000/api";
const origin = "http://localhost:15173";
const receiver = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
type Result = Record<string, unknown>;
type Options = {
  origin?: string;
  csrf?: string | null;
  contentType?: string;
  expect?: number | number[];
  cookie?: string;
  headers?: Record<string, string>;
};
function client(initialCookie?: string) {
  let cookie = initialCookie;
  return async <T = Result>(
    path: string,
    body?: unknown,
    options: Options = {},
  ): Promise<T> => {
    const headers = new Headers(options.headers);
    headers.set("connection", "close");
    if (options.cookie ?? cookie)
      headers.set("cookie", (options.cookie ?? cookie)!);
    if (body !== undefined) {
      headers.set("origin", options.origin ?? origin);
      if (options.csrf !== null)
        headers.set("x-arveluna-csrf", options.csrf ?? "1");
      headers.set("content-type", options.contentType ?? "application/json");
    }
    const response = await fetch(`${gateway}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    const result = (await response.json()) as Record<string, unknown>;
    const expected = options.expect;
    assert.ok(
      Array.isArray(expected)
        ? expected.includes(response.status)
        : expected
          ? response.status === expected
          : response.status < 300,
      `${path} HTTP ${response.status} ${(result.error as { code?: string } | undefined)?.code ?? ""}`,
    );
    const setCookie = response.headers.get("set-cookie");
    if (setCookie && path === "identity/login") {
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Strict/);
      assert.match(setCookie, /Max-Age=28800/);
      assert.deepEqual(result, { success: true });
      cookie = setCookie.split(";")[0];
    }
    return result as T;
  };
}
async function until<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeout = 24000,
) {
  const end = Date.now() + timeout;
  let value: T;
  do {
    value = await read();
    if (accept(value)) return value;
    await setTimeout(350);
  } while (Date.now() < end);
  assert.fail(`La operación quedó pendiente tras ${timeout} ms`);
}
type Product = {
  id: string;
  sku: string;
  balance: { available: number; reserved: number };
};
type Sale = {
  id: string;
  status: string;
  paymentId: string;
  totalBase: string;
  exception?: string;
  items: { quantity: number }[];
};
type Session = { id: string; expectedBase: string; differenceBase: string };
type Cash = { session: Session };
type User = { userId: string };
type Action = ReturnType<typeof client>;

async function product(
  api: Action,
  sku: string,
  asset: string,
  price: string,
  quantity: number,
  minimum = 3,
) {
  const p = await api<Product>("inventory/products", {
    sku,
    description: sku,
    asset,
    price,
    minimum,
  });
  await api("inventory/movements", {
    productId: p.id,
    reference: randomUUID(),
    quantity,
    kind: "IN",
    reason: "Entrada de prueba",
  });
  return p;
}
async function draft(
  api: Action,
  asset: string,
  productId: string,
  quantity = 1,
) {
  const sale = await api<Sale>("sales/sales", { id: randomUUID(), asset });
  await api(`sales/sales/${sale.id}/items`, {
    productId,
    quantity,
    totalBase: "1",
  });
  return sale.id;
}
async function checkout(api: Action, id: string) {
  return api<Sale>(`sales/sales/${id}/checkout`, {});
}
async function readSale(api: Action, id: string, status: string) {
  return until(
    () => api<Sale>(`sales/sales/${id}`),
    (s) => s.status === status,
  );
}
function broker(action: "broker-stop" | "broker-start") {
  const command = spawnSync(
    process.execPath,
    ["scripts/full-app.mjs", action, "test"],
    { stdio: "ignore" },
  );
  assert.equal(command.status, 0, "Operación de broker aislado");
}

async function publish(
  channel: ConfirmChannel,
  queue: string,
  message: Event,
  attempts?: string,
) {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
    messageId: message.eventId,
    headers: attempts ? { attempts } : undefined,
  });
  await channel.waitForConfirms();
}
async function deadLetter(channel: ConfirmChannel, id: string) {
  return until(
    async () => {
      const messages = [];
      try {
        const { messageCount } = await channel.checkQueue(
          "arveluna.sales.v1.dead",
        );
        for (let index = 0; index < messageCount; index++) {
          const delivery = await channel.get("arveluna.sales.v1.dead", {
            noAck: false,
          });
          if (!delivery) break;
          messages.push(delivery);
        }
        return messages.find(
          (delivery) => delivery.properties.messageId === id,
        );
      } finally {
        for (const delivery of messages) channel.nack(delivery, false, true);
      }
    },
    (message) => Boolean(message),
  );
}
async function replayAfterCommit(repo: PrismaSales, message: Event) {
  const handler = new Sales(repo, new HttpSaleOperations());
  const first = await amqp.connect(process.env.RABBITMQ_URL!);
  const queue = `arveluna.audit.${randomUUID()}`;
  try {
    const channel = await first.createConfirmChannel();
    await channel.assertQueue(queue, { durable: true, expires: 60_000 });
    await publish(channel, queue, message);
    const delivery = await channel.get(queue, { noAck: false });
    assert.ok(delivery);
    await handler.receive(
      JSON.parse(delivery.content.toString("utf8")) as Event,
    );
    assert.equal(
      await repo.db.processedEvent.count({
        where: { eventId: message.eventId },
      }),
      1,
    );
  } finally {
    await first.close();
  }
  const restarted = await amqp.connect(process.env.RABBITMQ_URL!);
  try {
    const channel = await restarted.createChannel();
    const delivery = await until(
      () => channel.get(queue, { noAck: false }),
      Boolean,
    );
    assert.ok(delivery && delivery.fields.redelivered);
    await new Sales(repo, new HttpSaleOperations()).receive(
      JSON.parse(delivery.content.toString("utf8")) as Event,
    );
    channel.ack(delivery);
    assert.equal(
      await repo.db.processedEvent.count({
        where: { eventId: message.eventId },
      }),
      1,
    );
    assert.equal((await channel.checkQueue(queue)).messageCount, 0);
  } finally {
    await restarted.close();
  }
}

test(
  "aplicación completa con HTTP, MySQL y RabbitMQ",
  { timeout: 190000 },
  async (t) => {
    validateTestProfile();
    const [a, b] = await Promise.all([merchantFixture(), merchantFixture()]);
    const api = client();
    const other = client();
    const health = await api<{ services: Record<string, string> }>("health");
    assert.equal(Object.keys(health.services).length, 8);
    assert.ok(
      Object.values(health.services).every((status) => status === "ok"),
    );
    for (const port of [
      13000, 13001, 13011, 13012, 13013, 13014, 13015, 13017, 13018,
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}/docs-json`);
      assert.equal(response.status, 200);
      const doc = (await response.json()) as { paths: Record<string, unknown> };
      assert.ok(Object.keys(doc.paths).length > 2);
      if (port === 13000) {
        assert.ok(doc.paths["/api/sales/sales/{id}/checkout"]);
        assert.ok(!doc.paths["/internal/sales/sales/{id}/checkout"]);
      }
    }
    const secrets = Object.entries(process.env)
      .filter(
        ([key, value]) =>
          /^(?:SERVICE_KEY_|SQL_PASSWORD_|MYSQL_ROOT_PASSWORD$|FULL_BROKER_PASSWORD$|DATABASE_URL$)/.test(
            key,
          ) && (value?.length ?? 0) > 12,
      )
      .map(([, value]) => value!);
    const assertRedacted = (body: unknown) => {
      const rendered = JSON.stringify(body);
      assert.ok(
        !secrets.some((secret) => rendered.includes(secret)),
        "La respuesta publica un secreto",
      );
      assert.ok(
        !/(?:passwordHash|tokenDigest|PrismaClient|at processTicksAndRejections)/.test(
          rendered,
        ),
      );
    };
    assertRedacted(health);
    for (const path of [
      "identity/users",
      "merchant/profile",
      "inventory/products",
      "sales/sales",
      "cash/register",
      "payments/orders",
      "payments/orders/unknown/audit",
      "imports/jobs",
      "analytics/diagnostics",
    ]) {
      assertRedacted(await api(path, undefined, { expect: 401 }));
    }
    for (const [options, status] of [
      [{ csrf: null }, 403],
      [{ csrf: "wrong" }, 403],
      [{ contentType: "text/plain" }, 403],
    ] as const)
      await api("identity/login", a, { ...options, expect: status });
    await api(
      "payments/orders",
      { merchantId: a.merchantId, amount: "10" },
      { expect: 404 },
    );
    for (const url of [
      "http://127.0.0.1:13000/internal/payments/orders",
      "http://127.0.0.1:13001/internal/payments/orders",
      "http://127.0.0.1:13011/internal/identity/login",
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      assert.ok([401, 404].includes(response.status));
      assertRedacted(await response.json());
    }
    await api("identity/login", a, {
      origin: "http://localhost:15174",
      expect: 403,
    });
    await api(
      "identity/login",
      { email: a.email, password: "wrong-password-test" },
      { expect: 401 },
    );
    await Promise.all([api("identity/login", a), other("identity/login", b)]);
    let coffee: Product;
    let usdt: Product;
    const payments = new PaymentsDb();
    const sales = new SalesDb();
    const stock = new InventoryDb();
    const cashDb = new CashDb();
    t.after(async () => {
      await Promise.all([
        payments.$disconnect(),
        sales.$disconnect(),
        stock.$disconnect(),
        cashDb.$disconnect(),
      ]);
    });
    await t.test("sesiones, roles y aislamiento entre comercios", async () => {
      const cashierEmail = `cash-${a.email}`;
      const cashier = await api<User>("identity/users", {
        email: cashierEmail,
        password: a.password,
        displayName: "Cajero",
        role: "CASHIER",
        merchantId: b.merchantId,
      });
      const employee = client();
      await employee("identity/login", {
        email: cashierEmail,
        password: a.password,
      });
      const user = await employee("identity/session");
      assert.equal(user.merchantId, a.merchantId);
      assert.equal(user.role, "CASHIER");
      const impersonate = {
        headers: {
          "x-user-role": "ADMIN",
          "x-merchant-id": b.merchantId,
          "x-arveluna-service": "gateway",
          "x-arveluna-key": "invalid",
          "x-arveluna-session": "0".repeat(64),
        },
        expect: 403,
      };
      await employee("identity/users", undefined, impersonate);
      await employee(
        "identity/users",
        { email: "rejected@example.test", role: "ADMIN" },
        impersonate,
      );
      await employee(
        "merchant/wallets",
        { network: "mainnet", asset: "USDT", address: receiver },
        impersonate,
      );
      await employee("inventory/movements", { kind: "IN" }, impersonate);
      await employee("cash/movements", { kind: "IN" }, impersonate);
      await employee("merchant/profile", { name: "Intento" }, { expect: 403 });
      await other(
        `identity/users/${cashier.userId}/deactivate`,
        {},
        { expect: 404 },
      );
      await api(`identity/users/${cashier.userId}/deactivate`, {});
      await employee("identity/session", undefined, { expect: 401 });
      const logout = client();
      await logout("identity/login", a);
      await logout("identity/logout", {});
      await logout("identity/session", undefined, { expect: 401 });
      await api("merchant/wallets", {
        network: "mainnet",
        asset: "USDT",
        address: receiver,
        merchantId: b.merchantId,
      });
      assert.deepEqual((await other("merchant/profile")).wallets, []);
      assert.equal((await api("merchant/profile")).id, a.merchantId);
      const direct = await fetch(
        "http://127.0.0.1:13013/internal/inventory/products",
        {
          headers: {
            "x-arveluna-service": "gateway",
            "x-arveluna-key": "invalid",
          },
        },
      );
      assert.equal(direct.status, 401);
      await api(
        "payments/checkout",
        { merchantId: a.merchantId },
        { expect: 404 },
      );
      const internalCheckout = await fetch(
        "http://127.0.0.1:13001/internal/payments/checkout",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-arveluna-service": "sales",
            "x-arveluna-key": "invalid",
          },
          body: JSON.stringify({
            merchantId: a.merchantId,
            saleId: randomUUID(),
            asset: "USDT",
            amount: "10.000000",
          }),
        },
      );
      assert.equal(internalCheckout.status, 401);
      assertRedacted(await internalCheckout.json());
      assertRedacted(await direct.json());
      for (const path of [
        "analytics/read/" + b.merchantId,
        "analytics/diagnostics",
        "identity/session",
      ]) {
        const port = path.startsWith("identity") ? 13011 : 13018;
        const response = await fetch(
          `http://127.0.0.1:${port}/internal/${path}`,
          {
            headers: {
              "x-arveluna-service": "gateway",
              "x-arveluna-key": "wrong",
              "x-user-role": "ADMIN",
              "x-merchant-id": b.merchantId,
              "x-arveluna-session": "f".repeat(64),
            },
          },
        );
        assert.ok([401, 404].includes(response.status));
        assertRedacted(await response.json());
      }
      for (const port of [
        13000, 13001, 13011, 13012, 13013, 13014, 13015, 13017, 13018,
      ]) {
        assertRedacted(
          await (await fetch(`http://127.0.0.1:${port}/docs-json`)).json(),
        );
      }
      await product(other, "SOLO-COMERCIO-B", "COP", "5", 1);
      await other("analytics/reconcile", {});
      assert.equal(
        JSON.stringify(await other("analytics/diagnostics")).includes(
          "SOLO-COMERCIO-B",
        ),
        true,
      );
      const scoped = await api(
        `analytics/diagnostics?merchantId=${b.merchantId}`,
        undefined,
        {
          headers: {
            "x-arveluna-session": "a".repeat(64),
            "x-merchant-id": b.merchantId,
          },
        },
      );
      assert.equal(JSON.stringify(scoped).includes("SOLO-COMERCIO-B"), false);
    });
    await t.test(
      "A: efectivo, reserva concurrente, idempotencia y cierre",
      async () => {
        const opened = await api<Session>("cash/open", {
          amount: "100",
          reference: randomUUID(),
        });
        coffee = await product(api, "CAFE", "COP", "30.00", 2);
        assert.equal(
          (await other<Product[]>("inventory/products?search=CAFE")).length,
          0,
        );
        await other(
          `inventory/products/${coffee.id}/deactivate`,
          {},
          { expect: 404 },
        );
        const [id, competitor] = await Promise.all([
          draft(api, "COP", coffee.id, 2),
          draft(api, "COP", coffee.id, 2),
        ]);
        await other(`sales/sales/${id}`, undefined, { expect: 404 });
        const outcomes = await Promise.all([
          checkout(api, id),
          checkout(api, id),
          checkout(api, competitor),
        ]);
        assert.ok(outcomes.every((s) => s.totalBase === "6000"));
        const rows = await until(
          () =>
            Promise.all([
              api<Sale>(`sales/sales/${id}`),
              api<Sale>(`sales/sales/${competitor}`),
            ]),
          (r) => r.every((s) => ["COMPLETED", "CANCELLED"].includes(s.status)),
        );
        assert.deepEqual(rows.map((s) => s.status).sort(), [
          "CANCELLED",
          "COMPLETED",
        ]);
        assert.equal(
          (await api<Cash>("cash/register")).session.expectedBase,
          "16000",
        );
        assert.deepEqual(
          (await api<Product[]>("inventory/products"))[0].balance,
          { productId: coffee.id, available: 0, reserved: 0 },
        );
        const closeReference = randomUUID();
        const closed = await api<Session>("cash/close", {
          amount: "155",
          reference: closeReference,
          sessionId: opened.id,
        });
        assert.equal(closed.differenceBase, "-500");
        assert.equal(
          (
            await api<Session>("cash/close", {
              amount: "155",
              reference: closeReference,
              sessionId: opened.id,
            })
          ).id,
          opened.id,
        );
        const noSession = await draft(
          api,
          "COP",
          (await product(api, "VASO", "COP", "5", 1)).id,
        );
        await api(`sales/sales/${noSession}/checkout`, {}, { expect: 409 });
        assert.equal((await readSale(api, noSession, "DRAFT")).status, "DRAFT");
      },
    );
    await t.test(
      "reservas simultáneas en Inventory y privilegios SQL por dueño",
      async () => {
        const productId = (await product(api, "CONCURRENTE", "COP", "1", 2)).id;
        await assert.rejects(
          stock.$queryRaw`SELECT id FROM arveluna_full_test_sales.Sale LIMIT 1`,
        );
        const ids = [randomUUID(), randomUUID()];
        const reserve = (id: string, release = false) =>
          fetch(
            `http://127.0.0.1:13013/internal/inventory/reservations/${a.merchantId}/${id}${release ? "/release" : ""}`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-arveluna-service": "sales",
                "x-arveluna-key": process.env.SERVICE_KEY_SALES!,
              },
              body: JSON.stringify(
                release
                  ? { userId: "concurrency-fixture" }
                  : { items: [{ productId, quantity: 2 }] },
              ),
            },
          );
        const responses = await Promise.all(ids.map((id) => reserve(id)));
        assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
        const [locked] = await api<Product[]>(
          "inventory/products?search=CONCURRENTE",
        );
        assert.equal(locked.balance.available, 0);
        assert.equal(locked.balance.reserved, 2);
        const winning = ids[responses.findIndex((r) => r.status === 201)];
        assert.equal((await reserve(winning, true)).status, 201);
        assert.equal((await reserve(winning, true)).status, 201);
        const [released] = await api<Product[]>(
          "inventory/products?search=CONCURRENTE",
        );
        assert.equal(released.balance.available, 2);
        assert.equal(released.balance.reserved, 0);
      },
    );
    await t.test(
      "B: TRC-20, caída y recuperación, hash duplicado y eventos",
      async () => {
        usdt = await product(api, "DIGITAL", "USDT", "10.00", 4);
        await api("cash/open", { amount: "50", reference: randomUUID() });
        const id = await draft(api, "USDT", usdt.id);
        await Promise.all([checkout(api, id), checkout(api, id)]);
        const awaiting = await readSale(api, id, "AWAITING_PAYMENT");
        const oid = awaiting.paymentId;
        assert.equal(
          await payments.paymentOrder.count({
            where: { merchantId: a.merchantId, saleId: id },
          }),
          1,
        );
        assert.equal(
          await stock.stockReservation.count({
            where: { merchantId: a.merchantId, saleId: id },
          }),
          1,
        );
        await other(`payments/orders/${oid}`, undefined, { expect: 404 });
        await other(`payments/orders/${oid}/audit`, undefined, { expect: 404 });
        await other(
          `payments/orders/${oid}/verify`,
          { transactionHash: "demo:valid:cross" },
          { expect: 404 },
        );
        await api(
          `payments/orders/${oid}/verify`,
          { transactionHash: "demo:typo:test" },
          { expect: 400 },
        );
        await api(
          `payments/orders/${oid}/verify`,
          { transactionHash: "demo:valid:valid", merchantId: b.merchantId },
          { expect: 400 },
        );
        const hash = `demo:multi:${randomUUID()}`;
        const order = await payments.paymentOrder.findUniqueOrThrow({
          where: { id: oid },
        });
        const invalid: Event = {
          eventId: randomUUID(),
          topic: "payment.confirmed.v1",
          version: 1,
          correlationId: id,
          merchantId: a.merchantId,
          occurredAt: new Date().toISOString(),
          data: {
            saleId: id,
            orderId: oid,
            asset: order.tokenSymbol,
            network: order.network,
            contract: order.tokenContract,
            amountBase: "10000001",
            scale: order.tokenDecimals,
            transactionHash: hash,
          },
        };
        await api(
          `payments/orders/${oid}/verify`,
          { transactionHash: `demo:unavailable:${randomUUID()}` },
          { expect: 503 },
        );
        assert.equal((await api(`payments/orders/${oid}`)).status, "PENDING");
        broker("broker-stop");
        let outbox;
        try {
          const results = await Promise.all([
            api(
              `payments/orders/${oid}/verify`,
              { transactionHash: hash },
              { expect: [201, 409] },
            ),
            api(
              `payments/orders/${oid}/verify`,
              { transactionHash: hash },
              { expect: [201, 409] },
            ),
            api(`sales/sales/${id}/cancel`, {}, { expect: 409 }),
          ]);
          assert.ok(
            results.some((response) => response.status === "CONFIRMED"),
          );
          await api(`payments/orders/${oid}/verify`, { transactionHash: hash });
          assert.equal(
            (await api(`sales/sales/${id}`)).status,
            "AWAITING_PAYMENT",
          );
          const rows = (
            await payments.outbox.findMany({
              where: { topic: "payment.confirmed.v1" },
            })
          ).filter(
            (row) =>
              (row.payload as { correlationId: string }).correlationId === id,
          );
          assert.equal(rows.length, 1);
          outbox = rows[0];
          assert.equal(outbox.sentAt, null);
          const identityPort = process.env.IDENTITY_PORT;
          let isolated:
            Awaited<ReturnType<typeof createPaymentsApp>> | undefined;
          try {
            process.env.IDENTITY_PORT = "1";
            isolated = await createPaymentsApp();
            await isolated.listen(0, "127.0.0.1");
            const blocked = await fetch(
              `${await isolated.getUrl()}/internal/payments/orders/${oid}/verify`,
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-arveluna-service": "gateway",
                  "x-arveluna-key": process.env.SERVICE_KEY_GATEWAY!,
                  "x-arveluna-session": "b".repeat(64),
                },
                body: JSON.stringify({ transactionHash: hash }),
              },
            );
            assert.equal(blocked.status, 503);
            assertRedacted(await blocked.json());
            assert.equal(
              (
                await payments.paymentOrder.findUniqueOrThrow({
                  where: { id: oid },
                })
              ).status,
              "CONFIRMED",
            );
            assert.equal(
              await stock.stockReservation.count({
                where: { saleId: id, status: "RESERVED" },
              }),
              1,
            );
          } finally {
            await isolated?.close();
            process.env.IDENTITY_PORT = identityPort;
          }
          assert.equal(
            await payments.blockchainTransaction.count({
              where: { transactionHash: hash },
            }),
            1,
          );
          assert.equal(
            await payments.paymentAuditEvent.count({
              where: {
                paymentOrderId: oid,
                newStatus: "CONFIRMED",
                eventType: "PAYMENT_VERIFIED",
              },
            }),
            1,
          );
        } finally {
          broker("broker-start");
        }
        await readSale(api, id, "COMPLETED");
        assert.ok(
          await sales.processedEvent.findUnique({
            where: { eventId: outbox.id },
          }),
        );
        const message = outbox.payload as unknown as Event;
        await replayAfterCommit(new PrismaSales(sales), {
          ...message,
          eventId: randomUUID(),
        });
        const brokerConnection = await amqp.connect(process.env.RABBITMQ_URL!);
        try {
          const channel = await brokerConnection.createConfirmChannel();
          channel.publish(
            "arveluna.domain.v1",
            outbox.topic,
            Buffer.from(JSON.stringify(outbox.payload)),
            { persistent: true, messageId: outbox.id },
          );
          await channel.waitForConfirms();
          const fresh = { ...message, eventId: randomUUID() };
          await publish(channel, "arveluna.sales.v1", fresh);
          await until(
            () =>
              sales.processedEvent.count({ where: { eventId: fresh.eventId } }),
            (count) => count === 1,
          );
          await publish(
            channel,
            "arveluna.sales.v1",
            invalid,
            "invalid-counter",
          );
          const dead = await deadLetter(channel, invalid.eventId);
          assert.equal(dead?.properties.headers?.attempts, 4);
          assert.equal(
            await sales.processedEvent.count({
              where: { eventId: invalid.eventId },
            }),
            0,
          );
          const completed = await sales.outbox.findMany({
            where: { topic: "sale.completed.v1" },
          });
          assert.equal(
            completed.filter(
              (entry) =>
                (entry.payload as { correlationId: string }).correlationId ===
                id,
            ).length,
            1,
          );
          assert.equal(
            await stock.stockMovement.count({
              where: {
                merchantId: a.merchantId,
                productId: usdt.id,
                kind: "SALE",
              },
            }),
            1,
          );
        } finally {
          await brokerConnection.close();
        }
        assert.equal(
          await sales.processedEvent.count({ where: { eventId: outbox.id } }),
          1,
        );
        assert.equal(
          (await api<Cash>("cash/register")).session.expectedBase,
          "5000",
        );
        const movements = await api<
          {
            kind: string;
            saleId: string;
            asset: string;
            sessionId: string | null;
          }[]
        >("cash/movements");
        const digital = movements.filter((m) => m.saleId === id);
        assert.equal(digital.length, 1);
        assert.equal(digital[0].asset, "USDT");
        assert.equal(digital[0].sessionId, null);
        const expired = await draft(api, "USDT", usdt.id);
        await checkout(api, expired);
        const pending = await readSale(api, expired, "AWAITING_PAYMENT");
        await api(
          `payments/orders/${pending.paymentId}/verify`,
          { transactionHash: hash },
          { expect: 409 },
        );
        await payments.paymentOrder.update({
          where: { id: pending.paymentId },
          data: { expiresAt: new Date(Date.now() - 1_000) },
        });
        await readSale(api, expired, "CANCELLED");
        const afterExpiry = (
          await api<Product[]>("inventory/products?search=DIGITAL")
        )[0];
        assert.equal(afterExpiry.balance.available, 3);
        assert.equal(afterExpiry.balance.reserved, 0);
        await api(`payments/orders/${pending.paymentId}/verify`, {
          transactionHash: `demo:valid:late-${randomUUID()}`,
        });
        const manual = await readSale(api, expired, "REVIEW");
        const evidence = await payments.paymentOrder.findUniqueOrThrow({
          where: { id: pending.paymentId },
        });
        assert.ok(evidence.confirmedAt && evidence.transactionHash);
        assert.ok(
          await payments.blockchainTransaction.findFirst({
            where: { transactionHash: evidence.transactionHash },
          }),
        );
        assert.equal(
          await payments.paymentAuditEvent.count({
            where: {
              paymentOrderId: pending.paymentId,
              eventType: "LATE_PAYMENT",
            },
          }),
          1,
        );
        const expiredEvent = (
          await payments.outbox.findMany({
            where: { topic: "payment.expired.v1" },
          })
        )
          .map((row) => row.payload as unknown as Event)
          .find((event) => event.correlationId === expired);
        assert.ok(expiredEvent);
        await new Sales(
          new PrismaSales(sales),
          new HttpSaleOperations(),
        ).receive({ ...expiredEvent, eventId: randomUUID() });
        assert.equal((await api(`sales/sales/${expired}`)).status, "REVIEW");
        assert.equal(manual.exception, "LATE_PAYMENT");
        assert.equal(
          (await api(`payments/orders/${pending.paymentId}`)).status,
          "EXPIRED",
        );
        assert.equal(
          (await api<{ saleId: string }[]>("cash/movements")).filter(
            (m) => m.saleId === expired,
          ).length,
          0,
        );
      },
    );
    await t.test(
      "C: CSV con errores por fila, confirmación repetida e idempotencia",
      async () => {
        const csv = Buffer.from(
          "sku,description,asset,price,minimum,opening_quantity\nIMPORTADO,Cuaderno,COP,5.75,6,4\nINVALIDO,Sin precio,COP,x,2,1\nCAFE,Y existente,COP,5,1,8\n",
        ).toString("base64");
        const input = { id: randomUUID(), csv };
        const job = await api<{ id: string }>("imports/jobs", input);
        assert.equal((await api("imports/jobs", input)).id, job.id);
        assert.equal((await api(`imports/jobs/${job.id}`)).status, "PREVIEW");
        assert.equal(
          (await api<Product[]>("inventory/products?search=IMPORTADO")).length,
          0,
        );
        await other(`imports/jobs/${job.id}`, undefined, { expect: 404 });
        await other(`imports/jobs/${job.id}/confirm`, {}, { expect: 404 });
        await other(`imports/jobs/${job.id}/retry`, {}, { expect: 404 });
        await Promise.all([
          api(`imports/jobs/${job.id}/confirm`, {}),
          api(`imports/jobs/${job.id}/confirm`, {}),
        ]);
        const finished = await until(
          () => api(`imports/jobs/${job.id}`),
          (r) => r.status === "DONE",
        );
        assert.deepEqual(finished.progress, {
          APPLIED: 1,
          FAILED: 1,
          INVALID: 1,
        });
        await api(`imports/jobs/${job.id}/confirm`, {});
        await api(`imports/jobs/${job.id}/retry`, {});
        const [item] = await api<Product[]>(
          "inventory/products?search=IMPORTADO",
        );
        assert.equal(item.balance.available, 4);
        assert.equal(
          (await api<unknown[]>(`inventory/movements?productId=${item.id}`))
            .length,
          1,
        );
      },
    );
    await t.test(
      "D: cortes, activos separados, reglas y simulación sin mutaciones",
      async () => {
        await api("analytics/reconcile", {});
        const report = await until(
          () =>
            api<{
              stale: boolean;
              salesByAsset: Record<string, unknown>;
              cashDifferences: unknown[];
            }>("analytics/diagnostics"),
          (value) => !value.stale,
        );
        assert.deepEqual(report.salesByAsset, {
          COP: { count: 1, amountBase: "6000" },
          USDT: { count: 1, amountBase: "10000000" },
        });
        assert.equal(report.cashDifferences.length, 1);
        const before = await api("inventory/products?search=CAFE");
        const simulated = await api("analytics/simulate", {
          productId: coffee.id,
          baselineDays: 30,
          horizonDays: 30,
          priceBasisPoints: 1000,
          demandBasisPoints: 5000,
        });
        assert.equal(simulated.projectedPriceBase, "3300");
        assert.equal(simulated.projectedUnits, "3");
        assert.equal(simulated.projectedRevenueBase, "9900");
        assert.equal(simulated.reorderUnits, "6");
        assert.deepEqual(await api("inventory/products?search=CAFE"), before);
        const rules = await api<{
          rules: { findings: unknown[]; sufficient: boolean }[];
        }>("analytics/recommendations");
        assert.ok(rules.rules[0].findings.length > 0);
        assert.equal(rules.rules[1].sufficient, false);
        assert.equal(rules.rules[2].findings.length, 1);
      },
    );
    await t.test("Shasta simulado separa ARVE de COP y USDT", async () => {
      await api("merchant/wallets", {
        network: "shasta",
        asset: "ARVE",
        address: receiver,
      });
      const item = await product(api, "DIGITAL-ARVE", "ARVE", "10", 1);
      const id = await draft(api, "ARVE", item.id);
      await api(
        `sales/sales/${id}/items`,
        { productId: usdt.id, quantity: 1 },
        { expect: 409 },
      );
      await checkout(api, id);
      const pending = await readSale(api, id, "AWAITING_PAYMENT");
      const order = await api(`payments/orders/${pending.paymentId}`);
      assert.equal(order.network, "shasta");
      assert.equal(order.tokenSymbol, "ARVE");
      await api(`payments/orders/${pending.paymentId}/verify`, {
        transactionHash: `demo:valid:arve-${randomUUID()}`,
      });
      await readSale(api, id, "COMPLETED");
      await api("analytics/reconcile", {});
      const totals = await until(
        () =>
          api<{ salesByAsset: Record<string, unknown> }>(
            "analytics/diagnostics",
          ),
        (row) => Object.hasOwn(row.salesByAsset, "ARVE"),
      );
      assert.deepEqual(totals.salesByAsset, {
        COP: { count: 1, amountBase: "6000" },
        USDT: { count: 1, amountBase: "10000000" },
        ARVE: { count: 1, amountBase: "10000000" },
      });
      const digital = await api<
        { saleId: string; amountBase: string; sessionId: string | null }[]
      >("cash/movements?asset=ARVE");
      assert.equal(digital.length, 1);
      assert.equal(digital[0].saleId, id);
      assert.equal(digital[0].sessionId, null);
      assert.equal(
        (await api<Cash>("cash/register")).session.expectedBase,
        "5000",
      );
    });
    await t.test(
      "cierre en carrera, dos workers y recuperación del efectivo ya asentado",
      async () => {
        const merchant = await merchantFixture();
        const audit = client();
        await audit("identity/login", merchant);
        const item = await product(audit, "CAJA-AUDIT", "COP", "8.00", 3);
        const cashSession = await audit<Session>("cash/open", {
          amount: "10",
          reference: randomUUID(),
        });
        const racing = await draft(audit, "COP", item.id);
        await Promise.all([
          audit(`sales/sales/${racing}/checkout`, {}, { expect: [201, 409] }),
          audit("cash/close", {
            sessionId: cashSession.id,
            amount: "10",
            reference: randomUUID(),
          }),
        ]);
        const raced = await until(
          () => audit<Sale>(`sales/sales/${racing}`),
          (sale) => ["DRAFT", "CANCELLED", "COMPLETED"].includes(sale.status),
        );
        const crossed = await cashDb.cashMovement.count({
          where: { saleId: racing },
        });
        assert.equal(crossed, raced.status === "COMPLETED" ? 1 : 0);
        const closed = await cashDb.cashSession.findUniqueOrThrow({
          where: { id: cashSession.id },
        });
        assert.equal(closed.expectedBase, crossed ? "1800" : "1000");

        const current = await audit<Session>("cash/open", {
          amount: "10",
          reference: randomUUID(),
        });
        const from = await draft(audit, "COP", item.id);
        const repo = new PrismaSales(
          sales,
          () => new Date(Date.now() + 7_200_000),
        );
        const independent = new SalesDb();
        t.after(() => independent.$disconnect());
        const rival = new PrismaSales(
          independent,
          () => new Date(Date.now() + 7_200_000),
        );
        const ops = new HttpSaleOperations();
        const original = await repo.get(merchant.merchantId, from);
        assert.ok(original);
        await ops.reserve(original);
        await ops.cash({
          ...original,
          method: "CASH",
          cashSessionId: current.id,
        });
        await sales.sale.update({
          where: { id: from },
          data: {
            status: "RECORDING_CASH",
            method: "CASH",
            cashSessionId: current.id,
            retryAt: new Date(Date.now() + 3_600_000),
          },
        });
        const claims = await Promise.all([repo.claim(from), rival.claim(from)]);
        assert.equal(claims.filter(Boolean).length, 1);
        const claimed = claims.find((claim) => claim !== null)!;
        await ops.cash(claimed);
        const persisted = await sales.sale.updateMany({
          where: { id: from, leaseToken: claimed.leaseToken },
          data: {
            status: "PAYMENT_CONFIRMED",
            leaseToken: null,
            leaseUntil: null,
            retryAt: new Date(Date.now() + 3_600_000),
          },
        });
        assert.equal(persisted.count, 1);
        class TemporarilyUnavailableInventory extends HttpSaleOperations {
          override async settle(): Promise<void> {
            fault(
              503,
              "COMMUNICATION_ERROR",
              "Fallo simulado de Inventory",
              true,
            );
          }
        }
        assert.equal(
          await new Sales(repo, new TemporarilyUnavailableInventory()).step(
            from,
          ),
          true,
        );
        const waiting = await repo.get(merchant.merchantId, from);
        assert.equal(waiting?.status, "PAYMENT_CONFIRMED");
        assert.equal(
          await cashDb.cashMovement.count({ where: { saleId: from } }),
          1,
        );
        assert.equal(
          await stock.stockReservation.count({
            where: { saleId: from, status: "RESERVED" },
          }),
          1,
        );
        await readSale(audit, from, "COMPLETED");
        assert.equal(
          await cashDb.cashMovement.count({ where: { saleId: from } }),
          1,
        );
        assert.equal(
          await stock.stockReservation.count({
            where: { saleId: from, status: "CONSUMED" },
          }),
          1,
        );

        const crypto = await product(audit, "TRANSITORIO", "USDT", "10", 1);
        const temporary = await draft(audit, "USDT", crypto.id);
        const pending = await repo.get(merchant.merchantId, temporary);
        assert.ok(pending);
        await ops.reserve(pending);
        await sales.sale.update({
          where: { id: temporary },
          data: {
            status: "OPENING_PAYMENT",
            method: "TRC20",
            retryAt: new Date(Date.now() + 3_600_000),
          },
        });
        class TemporarilyUnavailablePayments extends HttpSaleOperations {
          override async opening(): ReturnType<HttpSaleOperations["opening"]> {
            fault(
              503,
              "PROVIDER_UNAVAILABLE",
              "Fallo simulado de Payments",
              true,
            );
          }
        }
        assert.equal(
          await new Sales(repo, new TemporarilyUnavailablePayments()).step(
            temporary,
          ),
          true,
        );
        assert.equal(
          (await repo.get(merchant.merchantId, temporary))?.status,
          "OPENING_PAYMENT",
        );
        assert.equal(
          await stock.stockReservation.count({
            where: { saleId: temporary, status: "RESERVED" },
          }),
          1,
        );
        await audit("merchant/wallets", {
          network: "mainnet",
          asset: "USDT",
          address: receiver,
        });
        await readSale(audit, temporary, "AWAITING_PAYMENT");

        const last = await product(audit, "ULTIMA-UNIDAD", "COP", "8.00", 1);
        const contenders = await Promise.all([
          draft(audit, "COP", last.id),
          draft(audit, "COP", last.id),
        ]);
        await Promise.all(contenders.map((id) => checkout(audit, id)));
        const ended = await until(
          () =>
            Promise.all(
              contenders.map((id) => audit<Sale>(`sales/sales/${id}`)),
            ),
          (rows) =>
            rows.every((sale) =>
              ["COMPLETED", "CANCELLED"].includes(sale.status),
            ),
        );
        assert.deepEqual(ended.map((sale) => sale.status).sort(), [
          "CANCELLED",
          "COMPLETED",
        ]);
        assert.equal(
          await cashDb.cashMovement.count({
            where: { saleId: { in: contenders } },
          }),
          1,
        );
        assert.equal(
          await stock.stockMovement.count({
            where: { productId: last.id, kind: "SALE" },
          }),
          1,
        );
      },
    );
    await t.test(
      "Analytics rechaza en HTTP una fuente SQL de 5.001 filas sin servir un total truncado",
      async () => {
        const merchant = await merchantFixture();
        const oversized = client();
        await oversized("identity/login", merchant);
        await stock.product.createMany({
          data: Array.from({ length: 5001 }, (_, i) => ({
            merchantId: merchant.merchantId,
            sku: `LIMIT-${i}`,
            description: "Fixture de límite",
            asset: "COP",
            priceBase: "100",
            scale: 2,
            minimum: 0,
          })),
        });
        const result = await until(
          () => oversized("analytics/reconcile", {}, { expect: [201, 409] }),
          (value) =>
            (value.error as { code?: string } | undefined)?.code ===
            "PROJECTION_LIMIT",
        );
        assert.equal(result.success, false);
        const diagnostic = await oversized("analytics/diagnostics", undefined, {
          expect: [409, 503],
        });
        assert.ok(
          ["PROJECTION_LIMIT", "PROJECTION_PENDING"].includes(
            (diagnostic.error as { code: string }).code,
          ),
        );
        assert.equal(Object.hasOwn(diagnostic, "salesByAsset"), false);
      },
    );
  },
);
