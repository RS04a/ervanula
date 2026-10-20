import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CreatePaymentOrder,
  VerifyPayment,
  GetPaymentOrder,
} from "../apps/payments-service/src/application/use-cases/payments";
import { TronUsdtVerificationStrategy } from "../apps/payments-service/src/application/tron-usdt-verification.strategy";
import {
  SimulatedBlockchainProvider,
  DEMO_ADDRESS,
} from "../apps/payments-service/src/infrastructure/blockchain/simulated.provider";
import { BlockchainProviderProxy } from "../apps/payments-service/src/infrastructure/blockchain/provider.proxy";
import { toBaseUnits } from "../apps/payments-service/src/domain/services/payment-rules";
import { MemoryRepositories } from "./support/memory";
const config = {
  network: "mainnet",
  contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  expirationMinutes: 30,
  minConfirmations: 1,
};
const input = {
  saleId: "SALE-1",
  merchantId: "M-1",
  recipientAddress: DEMO_ADDRESS,
  amount: "10.00",
};
function setup() {
  const r = new MemoryRepositories();
  const p = new SimulatedBlockchainProvider(config.contract, config.network);
  const proxy = new BlockchainProviderProxy(p, 10, 1, { log() {} });
  return {
    r,
    p,
    create: new CreatePaymentOrder(r, config),
    verify: new VerifyPayment(r, r, proxy, new TronUsdtVerificationStrategy(1)),
  };
}
test("montos exactos, sin punto flotante", () => {
  assert.equal(
    toBaseUnits("99999999999999999999.123456"),
    "99999999999999999999123456",
  );
  for (const value of ["0", "-1", "1.1234567", "1e2", "NaN"])
    assert.throws(() => toBaseUnits(value));
});
test("creación y consulta con repositorios sustituibles", async () => {
  const { r, create } = setup();
  const order = await create.execute(input, "trace");
  assert.equal(order.amountBaseUnits, "10000000");
  assert.equal(
    (await new GetPaymentOrder(r).execute(order.id)).status,
    "PENDING",
  );
  assert.equal((await r.list(order.id))[0].eventType, "ORDER_CREATED");
});
for (const [scenario, code] of [
  ["token", "INVALID_TOKEN"],
  ["recipient", "WRONG_RECIPIENT"],
  ["amount", "AMOUNT_MISMATCH"],
  ["network", "NETWORK_MISMATCH"],
  ["failed", "TRANSACTION_FAILED"],
])
  test(`rechazo definitivo: ${scenario}`, async () => {
    const { r, create, verify } = setup();
    const order = await create.execute(input, "t");
    await assert.rejects(verify.execute(order.id, `demo:${scenario}:1`, "t"), {
      code,
    });
    assert.equal((await r.get(order.id))?.status, "REJECTED");
  });
for (const scenario of ["valid", "multi"])
  test(`confirmación: ${scenario}, auditoría e idempotencia`, async () => {
    const { r, create, verify } = setup();
    const order = await create.execute(input, "t");
    const hash = `demo:${scenario}:1`;
    assert.equal(
      (await verify.execute(order.id, hash, "t")).status,
      "CONFIRMED",
    );
    assert.equal(
      (await verify.execute(order.id, hash, "t")).status,
      "CONFIRMED",
    );
    assert.deepEqual(
      (await r.list(order.id)).map((e) => e.newStatus),
      ["PENDING", "DETECTED", "CONFIRMED"],
    );
  });
test("hash reutilizado no consume una segunda orden", async () => {
  const { create, verify, r } = setup();
  const a = await create.execute(input, "t");
  const b = await create.execute(input, "t");
  await verify.execute(a.id, "demo:valid:1", "t");
  await assert.rejects(verify.execute(b.id, "demo:valid:1", "t"), {
    code: "DUPLICATE_TRANSACTION",
  });
  assert.equal((await r.get(b.id))?.status, "PENDING");
});
test("orden vencida", async () => {
  const { create, verify, r } = setup();
  const order = await create.execute(input, "t");
  order.expiresAt = new Date(0);
  await r.commit(order, []);
  await assert.rejects(verify.execute(order.id, "demo:valid:1", "t"), {
    code: "ORDER_EXPIRED",
  });
  assert.equal((await r.get(order.id))?.status, "EXPIRED");
});
for (const [scenario, code] of [
  ["missing", "TRANSACTION_NOT_FOUND"],
  ["unavailable", "PROVIDER_UNAVAILABLE"],
  ["timeout", "PROVIDER_UNAVAILABLE"],
])
  test(`fallo recuperable: ${scenario}`, async () => {
    const { create, verify, r } = setup();
    const order = await create.execute(input, "t");
    await assert.rejects(verify.execute(order.id, `demo:${scenario}:1`, "t"), {
      code,
      retryable: true,
    });
    assert.equal((await r.get(order.id))?.status, "PENDING");
    assert.equal((await r.list(order.id)).at(-1)?.failureCode, code);
  });
test("insuficientes confirmaciones y posterior confirmación con misma transacción", async () => {
  const { create, r, p } = setup();
  const order = await create.execute(input, "t");
  let confirmed = false;
  const provider = {
    async getTransaction(hash: string) {
      const tx = await p.getTransaction(hash);
      return tx
        ? { ...tx, confirmed, confirmations: confirmed ? 10 : 0 }
        : null;
    },
  };
  const verify = new VerifyPayment(
    r,
    r,
    provider,
    new TronUsdtVerificationStrategy(1),
  );
  assert.equal(
    (await verify.execute(order.id, "demo:pending:1", "t")).status,
    "CONFIRMING",
  );
  confirmed = true;
  assert.equal(
    (await verify.execute(order.id, "demo:pending:1", "t")).status,
    "CONFIRMED",
  );
});
test("Strategy sustituible se ejecuta en el caso de uso", async () => {
  const { create, r, p } = setup();
  let called = 0;
  const strategy = {
    verify() {
      called++;
      return {
        transfer: {
          contractAddress: config.contract,
          senderAddress: DEMO_ADDRESS,
          recipientAddress: DEMO_ADDRESS,
          amountBaseUnits: "10000000",
        },
        confirmed: true,
      };
    },
  };
  const order = await create.execute(input, "t");
  await new VerifyPayment(r, r, p, strategy).execute(
    order.id,
    "demo:valid:1",
    "t",
  );
  assert.equal(called, 1);
});
test("Proxy limita reintentos y no reintenta errores definitivos", async () => {
  let calls = 0;
  const proxy = new BlockchainProviderProxy(
    {
      async getTransaction() {
        calls++;
        throw new Error("offline");
      },
    },
    10,
    2,
    { log() {} },
  );
  await assert.rejects(proxy.getTransaction("hash"), {
    code: "PROVIDER_UNAVAILABLE",
  });
  assert.equal(calls, 3);
});

test("Proxy no reintenta datos inválidos del proveedor", async () => {
  const { p } = setup();
  let calls = 0;
  const proxy = new BlockchainProviderProxy(
    {
      async getTransaction(hash) {
        calls++;
        const tx = await p.getTransaction(hash);
        return tx ? { ...tx, blockNumber: "invalid" } : null;
      },
    },
    20,
    2,
    { log() {} },
  );
  await assert.rejects(proxy.getTransaction("demo:valid:bad"), {
    code: "INVALID_TRANSACTION_DATA",
    retryable: false,
  });
  assert.equal(calls, 1);
});
