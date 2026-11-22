import { test } from "node:test";
import assert from "node:assert/strict";
import { TronGridPaymentProvider } from "../apps/payments-service/src/infrastructure/blockchain/trongrid-payment.provider";
import { BlockchainProviderProxy } from "../apps/payments-service/src/infrastructure/blockchain/provider.proxy";
import {
  CreatePaymentOrder,
  VerifyPayment,
} from "../apps/payments-service/src/application/use-cases/payments";
import { TronUsdtVerificationStrategy } from "../apps/payments-service/src/application/tron-usdt-verification.strategy";
import {
  normalizeTronAddress,
  tronAddressFromTopic,
} from "../apps/payments-service/src/domain/services/tron-address";
import { AppConfig } from "../apps/payments-service/src/infrastructure/config/config";
import { selectBlockchainProvider } from "../apps/payments-service/src/infrastructure/blockchain/provider.factory";
import { SimulatedBlockchainProvider } from "../apps/payments-service/src/infrastructure/blockchain/simulated.provider";
import { MemoryRepositories } from "./support/memory";
import {
  tronFixture,
  fixtureHttp,
  HASH,
  CONTRACT,
  CONTRACT_HEX,
  RECIPIENT,
  RECIPIENT_HEX,
  OPTIONS,
} from "./support/trongrid.fixture";
async function setup() {
  const repository = new MemoryRepositories();
  const order = await new CreatePaymentOrder(repository, {
    network: "mainnet",
    contract: CONTRACT,
    expirationMinutes: 30,
    minConfirmations: 1,
  }).execute(
    {
      saleId: "TRONGRID-TEST",
      merchantId: "TEST",
      recipientAddress: RECIPIENT,
      amount: "10.00",
    },
    "trace",
  );
  const fixture = tronFixture(order.createdAt.getTime() + 1);
  const { http, requests } = fixtureHttp(fixture);
  const provider = new TronGridPaymentProvider(OPTIONS, http);
  const proxy = new BlockchainProviderProxy(provider, 100, 1, { log() {} });
  return {
    repository,
    order,
    fixture,
    requests,
    provider,
    verify: new VerifyPayment(
      repository,
      repository,
      proxy,
      new TronUsdtVerificationStrategy(1),
    ),
  };
}
test("direcciones: vector público Base58Check/hex TRON y ABI; checksum y padding inválidos", () => {
  assert.equal(CONTRACT, "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
  for (const address of [
    CONTRACT,
    CONTRACT_HEX,
    "41" + CONTRACT_HEX,
    "0x" + CONTRACT_HEX,
    "0x41" + CONTRACT_HEX.toUpperCase(),
  ])
    assert.equal(normalizeTronAddress(address), CONTRACT);
  assert.equal(tronAddressFromTopic("0".repeat(24) + CONTRACT_HEX), CONTRACT);
  for (const address of [
    CONTRACT.slice(0, -1) + "1",
    "42" + CONTRACT_HEX,
    "0xgg",
    "",
  ])
    assert.throws(() => normalizeTronAddress(address), {
      code: "INVALID_TRANSACTION_DATA",
    });
  assert.throws(() => tronAddressFromTopic("1".repeat(24) + CONTRACT_HEX));
});
test("TronGrid: orden válida confirmada, 4 lecturas, evidencia limpia e idempotencia", async () => {
  const { order, verify, requests, repository } = await setup();
  assert.equal(
    (await verify.execute(order.id, HASH.toUpperCase(), "trace")).status,
    "CONFIRMED",
  );
  const count = requests.length;
  assert.equal(count, 4);
  assert.equal(
    (await verify.execute(order.id, HASH, "trace")).status,
    "CONFIRMED",
  );
  assert.equal(requests.length, count);
  assert.deepEqual(
    (await repository.list(order.id)).map((e) => e.newStatus),
    ["PENDING", "DETECTED", "CONFIRMED"],
  );
  assert.ok(
    requests.every(
      (request) =>
        request.init?.method === "POST" &&
        request.init?.signal &&
        request.init?.redirect === "manual",
    ),
  );
});
for (const [scenario, code] of [
  ["contract", "INVALID_TOKEN"],
  ["recipient", "WRONG_RECIPIENT"],
  ["amount", "AMOUNT_MISMATCH"],
  ["failed", "TRANSACTION_FAILED"],
  ["not-trc20", "INVALID_TOKEN"],
] as const)
  test(`TronGrid: ${scenario}`, async () => {
    const { fixture, order, verify, repository } = await setup();
    if (scenario === "contract") fixture.receipt.log[0].address = RECIPIENT_HEX;
    if (scenario === "recipient")
      fixture.receipt.log[0].topics[2] = "0".repeat(24) + CONTRACT_HEX;
    if (scenario === "amount")
      fixture.receipt.log[0].data = "1".padStart(64, "0");
    if (scenario === "failed") {
      fixture.receipt.receipt.result = "REVERT";
      fixture.body.ret[0].contractRet = "REVERT";
      fixture.receipt.log = [];
    }
    if (scenario === "not-trc20")
      fixture.body.raw_data.contract[0].type = "TransferContract";
    fixture.solid = structuredClone(fixture.receipt);
    await assert.rejects(verify.execute(order.id, HASH, "trace"), { code });
    assert.equal((await repository.get(order.id))?.status, "REJECTED");
  });
test("TronGrid: no encontrada permanece recuperable", async () => {
  const { order, fixture, verify, repository } = await setup();
  Object.keys(fixture.body).forEach(
    (key) => delete (fixture.body as Record<string, unknown>)[key],
  );
  await assert.rejects(verify.execute(order.id, HASH, "trace"), {
    code: "TRANSACTION_NOT_FOUND",
    retryable: true,
  });
  assert.equal((await repository.get(order.id))?.status, "PENDING");
});
test("TronGrid: solidificación y umbral de confirmaciones son condiciones independientes", async () => {
  const { fixture, order, verify, repository, provider } = await setup();
  fixture.solid = {};
  assert.equal(
    (await verify.execute(order.id, HASH, "trace")).status,
    "CONFIRMING",
  );
  fixture.solid = structuredClone(fixture.receipt);
  fixture.head.block_header.raw_data.number = 100;
  const highThreshold = new VerifyPayment(
    repository,
    repository,
    provider,
    new TronUsdtVerificationStrategy(2),
  );
  assert.equal(
    (await highThreshold.execute(order.id, HASH, "trace")).status,
    "CONFIRMING",
  );
  fixture.head.block_header.raw_data.number = 101;
  assert.equal(
    (await highThreshold.execute(order.id, HASH, "trace")).status,
    "CONFIRMED",
  );
});
test("TronGrid: hash consumido por otra orden", async () => {
  const { repository, order, verify } = await setup();
  await verify.execute(order.id, HASH, "t");
  const second = await new CreatePaymentOrder(repository, {
    network: "mainnet",
    contract: CONTRACT,
    expirationMinutes: 30,
    minConfirmations: 1,
  }).execute(
    {
      saleId: "T2",
      merchantId: "M",
      recipientAddress: RECIPIENT,
      amount: "10",
    },
    "t",
  );
  await assert.rejects(verify.execute(second.id, HASH, "t"), {
    code: "DUPLICATE_TRANSACTION",
  });
  assert.equal((await repository.get(second.id))?.status, "PENDING");
});
test("TronGrid: orden vencida no consulta al proveedor", async () => {
  const { repository, order, verify, requests } = await setup();
  order.expiresAt = new Date(0);
  await repository.commit(order, []);
  await assert.rejects(verify.execute(order.id, HASH, "t"), {
    code: "ORDER_EXPIRED",
  });
  assert.equal(requests.length, 0);
});
test("TronGrid: múltiples Transfer, normalización en Strategy y precisión uint256", async () => {
  const { fixture, order, verify, repository } = await setup();
  fixture.receipt.log.unshift({
    ...fixture.receipt.log[0],
    data: "1".padStart(64, "0"),
  });
  fixture.solid = structuredClone(fixture.receipt);
  order.recipientAddress = "41" + RECIPIENT_HEX;
  order.tokenContract = "0x" + CONTRACT_HEX.toUpperCase();
  await repository.commit(order, []);
  assert.equal((await verify.execute(order.id, HASH, "t")).status, "CONFIRMED");
  const tx = await new TronGridPaymentProvider(
    OPTIONS,
    fixtureHttp({
      ...fixture,
      receipt: {
        ...fixture.receipt,
        log: [{ ...fixture.receipt.log[0], data: "f".repeat(64) }],
      },
      solid: {},
    }).http,
  ).getTransaction(HASH);
  assert.equal(
    tx?.transfers[0].amountBaseUnits,
    ((1n << 256n) - 1n).toString(),
  );
});
for (const status of [429, 503, 401, 403, 400, 404, 302])
  test(`TronGrid HTTP ${status}: reintentos y orden recuperable`, async () => {
    const { repository, order } = await setup();
    let calls = 0;
    const provider = new TronGridPaymentProvider(OPTIONS, async () => {
      calls++;
      return new Response("{}", { status });
    });
    const proxy = new BlockchainProviderProxy(provider, 100, 2, { log() {} });
    const verify = new VerifyPayment(
      repository,
      repository,
      proxy,
      new TronUsdtVerificationStrategy(1),
    );
    await assert.rejects(verify.execute(order.id, HASH, "t"), {
      code: "PROVIDER_UNAVAILABLE",
      retryable: [429, 503].includes(status),
    });
    assert.equal(calls, [429, 503].includes(status) ? 3 : 1);
    assert.equal((await repository.get(order.id))?.status, "PENDING");
    assert.equal(
      (await repository.list(order.id)).at(-1)?.failureCode,
      "PROVIDER_UNAVAILABLE",
    );
  });
test("TronGrid timeout: AbortSignal cancela la solicitud y el Proxy limita intentos", async () => {
  let calls = 0,
    aborts = 0;
  const provider = new TronGridPaymentProvider(
    { ...OPTIONS, timeoutMs: 15 },
    async (_input, init) => {
      calls++;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            aborts++;
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    },
  );
  const keepAlive = setInterval(() => {}, 50);
  try {
    await assert.rejects(
      new BlockchainProviderProxy(provider, 10, 1, { log() {} }).getTransaction(
        HASH,
      ),
      { code: "PROVIDER_UNAVAILABLE", retryable: true },
    );
    assert.equal(calls, 2);
    assert.equal(aborts, 2);
  } finally {
    clearInterval(keepAlive);
  }
});
for (const scenario of [
  "json",
  "array",
  "receipt",
  "log",
  "padding",
  "hash",
  "head",
  "large",
])
  test(`TronGrid respuesta malformada: ${scenario}`, async () => {
    const { fixture, provider } = await setup();
    if (scenario === "json" || scenario === "array" || scenario === "large") {
      const response =
        scenario === "json"
          ? "{bad"
          : scenario === "large"
            ? " ".repeat(2_000_001)
            : "[]";
      await assert.rejects(
        new TronGridPaymentProvider(
          OPTIONS,
          async () => new Response(response),
        ).getTransaction(HASH),
        { code: "INVALID_TRANSACTION_DATA" },
      );
      return;
    }
    if (scenario === "receipt")
      delete (fixture.receipt as Record<string, unknown>).receipt;
    if (scenario === "log") fixture.receipt.log[0].data = "0x123";
    if (scenario === "padding")
      fixture.receipt.log[0].topics[1] = "f".repeat(64);
    if (scenario === "hash") fixture.receipt.id = "cd".repeat(32);
    if (scenario === "head") fixture.head.block_header.raw_data.number = 1.5;
    await assert.rejects(provider.getTransaction(HASH), {
      code: "INVALID_TRANSACTION_DATA",
    });
  });
test("TronGrid: recibo pendiente y desacuerdo con recibo solidificado son recuperables", async () => {
  const { fixture, provider } = await setup();
  fixture.solid = { ...fixture.receipt, blockNumber: 99 };
  await assert.rejects(provider.getTransaction(HASH), {
    code: "PROVIDER_UNAVAILABLE",
    retryable: true,
  });
  Object.keys(fixture.receipt).forEach(
    (key) => delete (fixture.receipt as Record<string, unknown>)[key],
  );
  await assert.rejects(provider.getTransaction(HASH), {
    code: "PROVIDER_UNAVAILABLE",
    retryable: true,
  });
});
test("TronGrid: API key solo en header, no en evidencia ni errores; sin reintento de Error HTTP 200", async () => {
  const { fixture } = await setup();
  const { requests, http } = fixtureHttp(fixture);
  const provider = new TronGridPaymentProvider(
    { ...OPTIONS, apiKey: "fixture-only-placeholder" },
    http,
  );
  const tx = await provider.getTransaction(HASH);
  assert.ok(
    requests.every(
      (r) =>
        new Headers(r.init?.headers).get("TRON-PRO-API-KEY") ===
        "fixture-only-placeholder",
    ),
  );
  assert.ok(!JSON.stringify(tx).includes("fixture-only-placeholder"));
  let count = 0;
  const failed = new TronGridPaymentProvider(OPTIONS, async () => {
    count++;
    return Response.json({ Error: "do not expose upstream detail" });
  });
  await assert.rejects(
    new BlockchainProviderProxy(failed, 100, 2, { log() {} }).getTransaction(
      HASH,
    ),
    { code: "PROVIDER_UNAVAILABLE", retryable: false },
  );
  assert.equal(count, 1);
});
test("configuración y selección de adaptadores: defaults, aliases y red/endpoint coherentes", () => {
  const backup = { ...process.env };
  try {
    delete process.env.PAYMENT_PROVIDER;
    process.env.BLOCKCHAIN_PROVIDER = "simulated";
    process.env.DATABASE_URL = "mysql://fixture@127.0.0.1:1/fixture";
    process.env.USDT_CONTRACT_ADDRESS = CONTRACT;
    delete process.env.TRC20_TOKEN_CONTRACT;
    process.env.TRON_NETWORK = "mainnet";
    process.env.TRONGRID_BASE_URL = OPTIONS.baseUrl;
    assert.ok(
      selectBlockchainProvider(new AppConfig()) instanceof
        SimulatedBlockchainProvider,
    );
    process.env.PAYMENT_PROVIDER = "trongrid";
    process.env.TRC20_TOKEN_CONTRACT = "41" + CONTRACT_HEX;
    process.env.TRON_MIN_CONFIRMATIONS = "3";
    const config = new AppConfig();
    assert.equal(config.minConfirmations, 3);
    assert.ok(
      selectBlockchainProvider(
        config,
        fixtureHttp(tronFixture()).http,
      ) instanceof TronGridPaymentProvider,
    );
    process.env.TRON_NETWORK = "shasta";
    assert.throws(() => new AppConfig(), /endpoint/);
    process.env.TRONGRID_BASE_URL = "https://api.shasta.trongrid.io";
    assert.equal(new AppConfig().network, "shasta");
    process.env.TRONGRID_BASE_URL = "https://example.com";
    assert.throws(() => new AppConfig());
    process.env.PAYMENT_PROVIDER = "invalid";
    assert.throws(() => new AppConfig());
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in backup)) delete process.env[key];
    Object.assign(process.env, backup);
  }
});

test("TronGrid: origen Shasta etiqueta red y Strategy rechaza orden mainnet", async () => {
  const { fixture, order } = await setup();
  const tx = await new TronGridPaymentProvider(
    {
      ...OPTIONS,
      baseUrl: "https://api.shasta.trongrid.io",
      network: "shasta",
    },
    fixtureHttp(fixture).http,
  ).getTransaction(HASH);
  assert.ok(tx);
  assert.equal(tx.network, "shasta");
  assert.throws(() => new TronUsdtVerificationStrategy(1).verify(order, tx), {
    code: "NETWORK_MISMATCH",
  });
});
test("TronGrid: cuerpo pendiente sin ret ni recibo conserva fallo recuperable", async () => {
  const { fixture, provider } = await setup();
  delete (fixture.body as Record<string, unknown>).ret;
  Object.keys(fixture.receipt).forEach(
    (key) => delete (fixture.receipt as Record<string, unknown>)[key],
  );
  await assert.rejects(provider.getTransaction(HASH), {
    code: "PROVIDER_UNAVAILABLE",
    retryable: true,
  });
});

test("TronGrid: Transfer ERC-721 ajeno no oculta el Transfer TRC-20 coincidente", async () => {
  const { fixture, provider } = await setup();
  const log = fixture.receipt.log[0];
  fixture.receipt.log.unshift({
    ...log,
    topics: [...log.topics, "0".repeat(64)],
    data: "",
  });
  fixture.solid = structuredClone(fixture.receipt);
  const tx = await provider.getTransaction(HASH);
  assert.equal(tx?.transfers.length, 1);
  assert.equal(tx?.transfers[0].amountBaseUnits, "10000000");
});
