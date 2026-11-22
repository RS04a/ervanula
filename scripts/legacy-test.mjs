import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import process from "node:process";
import { parseEnv } from "node:util";

const privateProfile = ".env.full-test";
const profile = parseEnv(readFileSync(privateProfile, "utf8"));
const compose = [
  "compose",
  "-f",
  "docker-compose.full-app.yml",
  "-p",
  "arveluna-full-test",
  "--env-file",
  privateProfile,
];
const composeEnv = { ...process.env, ...profile };
const engines = "node_modules/@prisma/engines";
const schemaEngine = readdirSync(engines).find((name) =>
  name.startsWith("schema-engine-"),
);
if (
  !schemaEngine ||
  profile.FULL_MYSQL_PORT !== "43376" ||
  !/^[a-f0-9]{64}$/.test(profile.MYSQL_ROOT_PASSWORD ?? "")
)
  throw new Error(
    "Ejecuta la preparación de arveluna-full-test y genera Prisma",
  );
const mapping = spawnSync("docker", [...compose, "port", "mysql", "3306"], {
  env: composeEnv,
  encoding: "utf8",
});
if (mapping.status !== 0 || mapping.stdout.trim() !== "127.0.0.1:43376")
  throw new Error("No se encontró MySQL aislado en 127.0.0.1:43376");

const suffix = randomBytes(6).toString("hex");
const schema = `arveluna_legacy_test_${suffix}`;
const user = `arv_legacy_${suffix}`;
const password = randomBytes(32).toString("hex");
const sql = `CREATE DATABASE \`${schema}\`;
CREATE USER '${user}'@'%' IDENTIFIED BY '${password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON \`${schema}\`.* TO '${user}'@'%';`;
const created = spawnSync(
  "docker",
  [
    ...compose,
    "exec",
    "-T",
    "mysql",
    "sh",
    "-c",
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot',
  ],
  { env: composeEnv, input: sql, encoding: "utf8" },
);
if (created.status !== 0)
  throw new Error("No se pudo aprovisionar el esquema histórico aislado");

const env = {
  ...process.env,
  ARVELUNA_LEGACY_TEST: "true",
  ARVELUNA_FULL_APP: "false",
  DATABASE_URL: `mysql://${user}:${password}@127.0.0.1:43376/${schema}`,
  PRISMA_SCHEMA_ENGINE_BINARY: `${process.cwd()}/${engines}/${schemaEngine}`,
  GATEWAY_PORT: "23000",
  PAYMENTS_PORT: "23001",
  PAYMENTS_SERVICE_URL: "http://127.0.0.1:23001",
  FRONTEND_ORIGIN: "http://localhost:25173",
  PAYMENT_PROVIDER: "simulated",
  TRON_NETWORK: "mainnet",
  TRC20_TOKEN_CONTRACT: "",
  USDT_CONTRACT_ADDRESS: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  USDT_DECIMALS: "6",
  TRONGRID_API_KEY: "",
  ARVE_CONTRACT_ADDRESS: "",
};
const run = (command, args) => {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, [
  "node_modules/prisma/build/index.js",
  "migrate",
  "deploy",
  "--schema",
  "backend/prisma/schema.prisma",
]);
run("npm", ["run", "test:e2e"]);
run("npm", ["run", "test:browser"]);
