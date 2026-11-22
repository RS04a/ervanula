import assert from "node:assert/strict";
import { test } from "node:test";
import { baseUnits, decimal } from "../libs/full-app/money";
import { change } from "../apps/inventory-service/src/domain/stock";
import { NodeSecrets } from "../apps/identity-service/src/infrastructure/secrets";
import { AppConfig } from "../apps/payments-service/src/infrastructure/config/config";

test("monedas y stock con unidades enteras y escalas independientes", () => {
  assert.equal(baseUnits("12345678901234.56", "COP"), "1234567890123456");
  assert.equal(
    baseUnits("12345678901234.567891", "USDT"),
    "12345678901234567891",
  );
  assert.equal(decimal("-12345", 2), "-123.45");
  assert.throws(() => baseUnits(12.5, "COP"), { code: "INVALID_AMOUNT" });
  assert.throws(() => baseUnits("1.234", "COP"), { code: "INVALID_AMOUNT" });
  assert.throws(() => change({ available: 0, reserved: 2 }, 1, "reserve"), {
    code: "INSUFFICIENT_STOCK",
  });
  assert.deepEqual(change({ available: 0, reserved: 2 }, 2, "consume"), {
    available: 0,
    reserved: 0,
  });
});
test("scrypt usa salt independiente y el digest de sesión cambia al rotar token", async () => {
  const secrets = new NodeSecrets();
  const [first, second] = await Promise.all([
    secrets.hash("fixture-long-password"),
    secrets.hash("fixture-long-password"),
  ]);
  assert.notEqual(first, second);
  assert.equal(await secrets.compare("fixture-long-password", first), true);
  assert.equal(await secrets.compare("wrong-fixture-password", first), false);
  const token = secrets.issue();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(secrets.digest(token), token);
  assert.notEqual(secrets.digest(token), secrets.digest(secrets.issue()));
});
test("ARVE preparado como perfil independiente; USDT simulado permanece disponible", () => {
  const values = {
    DATABASE_URL: "mysql://fixture@127.0.0.1:1/fixture",
    USDT_CONTRACT_ADDRESS: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    TRC20_TOKEN_CONTRACT: "",
    TRON_NETWORK: "mainnet",
    PAYMENT_PROVIDER: "simulated",
    ARVE_CONTRACT_ADDRESS: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
    ARVE_TRON_NETWORK: "nile",
    ARVE_PAYMENT_PROVIDER: "trongrid",
    ARVE_TRONGRID_BASE_URL: "",
    ARVE_TRONGRID_API_KEY: "",
  };
  const prior = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, values);
    const config = new AppConfig();
    assert.equal(config.provider, "simulated");
    assert.equal(config.network, "mainnet");
    assert.equal(config.arve?.provider, "trongrid");
    assert.equal(config.arve?.network, "nile");
    assert.notEqual(config.arve?.contract, config.contract);
    delete process.env.ARVE_CONTRACT_ADDRESS;
    assert.equal(new AppConfig().arve, undefined);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Analytics acepta 5.000 filas completas y rechaza el registro 5.001", async () => {
  const { readComplete } =
    await import("../apps/analytics-service/src/infrastructure/collect");
  const page = (size: number) => async (offset: number) =>
    Array.from(
      { length: Math.min(25, Math.max(0, size - offset)) },
      (_, index) => offset + index,
    );
  const rows = await readComplete(page(5000));
  assert.equal(rows.length, 5000);
  assert.equal(rows[4999], 4999);
  await assert.rejects(readComplete(page(5001)), {
    code: "PROJECTION_LIMIT",
    httpStatus: 409,
  });
});

test("el perfil histórico y el seed rechazan bases y usuario SQL reservados", async () => {
  const { assertLegacyPaymentsDatabase } =
    await import("../libs/contracts/environment");
  assert.doesNotThrow(() =>
    assertLegacyPaymentsDatabase("mysql://demo@127.0.0.1/arveluna_payments"),
  );
  assert.throws(() =>
    assertLegacyPaymentsDatabase(
      "mysql://demo@127.0.0.1/arveluna_full_payments",
    ),
  );
  assert.throws(() =>
    assertLegacyPaymentsDatabase(
      "mysql://demo@127.0.0.1/%61rveluna_full_test_payments",
    ),
  );
  assert.throws(() =>
    assertLegacyPaymentsDatabase("mysql://arv_payments@127.0.0.1/other"),
  );
});
