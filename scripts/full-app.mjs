import process from "node:process";
import { URL } from "node:url";

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

const owners = [
  "identity",
  "merchant",
  "inventory",
  "sales",
  "cash",
  "payments",
  "imports",
  "analytics",
];
const apps = {
  identity: 3011,
  merchant: 3012,
  inventory: 3013,
  sales: 3014,
  cash: 3015,
  payments: 3001,
  imports: 3017,
  analytics: 3018,
};
const [action, profile = "local"] = process.argv.slice(2);
if (!["local", "test"].includes(profile)) throw new Error("Perfil inválido");
const test = profile === "test";
const envFile = test ? ".env.full-test" : ".env.full-app";
const project = test ? "arveluna-full-test" : "arveluna-full";
const env = { ...process.env };
const dbPort = test ? 43376 : 33376;
const brokerPort = test ? 45772 : 35772;
const apiOffset = test ? 10000 : 0;
const secret = () => randomBytes(32).toString("hex");
const schema = (owner) =>
  owner === "payments"
    ? "backend/prisma/schema.prisma"
    : `backend/prisma/${owner}/schema.prisma`;
const schemas = () => owners.filter((owner) => existsSync(schema(owner)));
const engineDir = "node_modules/@prisma/engines";
function useLocalEngines() {
  const engines = readdirSync(engineDir);
  const query = engines.find(
    (file) =>
      /^libquery_engine-.+\.node$/.test(file) ||
      /^query_engine-.+\.dll\.node$/.test(file),
  );
  const migration = engines.find((file) => /^schema-engine-/.test(file));
  if (query)
    env.PRISMA_QUERY_ENGINE_LIBRARY = `${process.cwd()}/${engineDir}/${query}`;
  if (migration)
    env.PRISMA_SCHEMA_ENGINE_BINARY = `${process.cwd()}/${engineDir}/${migration}`;
}
function command(executable, args, environment = env) {
  const result = spawnSync(executable, args, {
    stdio: "inherit",
    env: environment,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (action === "env") {
  if (existsSync(envFile)) {
    console.log("Perfil existente conservado.");
    process.exit(0);
  }
  const brokerPassword = secret();
  const values = {
    ARVELUNA_FULL_APP: "true",
    SESSION_SECURE: "false",
    MYSQL_ROOT_PASSWORD: secret(),
    FULL_MYSQL_PORT: dbPort,
    FULL_BROKER_PORT: brokerPort,
    FULL_BROKER_UI_PORT: test ? 55772 : 35773,
    FULL_BROKER_PASSWORD: brokerPassword,
    RABBITMQ_URL: `amqp://arveluna:${brokerPassword}@127.0.0.1:${brokerPort}`,
    GATEWAY_PORT: 3000 + apiOffset,
    FRONTEND_ORIGIN: `http://localhost:${5173 + apiOffset}`,
    SERVICE_KEY_GATEWAY: secret(),
    BLOCKCHAIN_PROVIDER: "simulated",
    TRON_NETWORK: "mainnet",
    USDT_CONTRACT_ADDRESS: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  };
  for (const owner of owners) {
    const upper = owner.toUpperCase();
    const password = secret();
    values[`SQL_PASSWORD_${upper}`] = password;
    values[`SERVICE_KEY_${upper}`] = secret();
    values[`${upper}_PORT`] = apps[owner] + apiOffset;
    values[owner === "payments" ? "DATABASE_URL" : `${upper}_DATABASE_URL`] =
      `mysql://arv_${owner}:${password}@127.0.0.1:${dbPort}/${project.replaceAll("-", "_")}_${owner}`;
  }
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log("Perfil privado generado.");
} else if (action === "generate") {
  useLocalEngines();
  for (const owner of schemas())
    command(process.execPath, [
      "node_modules/prisma/build/index.js",
      "generate",
      "--schema",
      schema(owner),
    ]);
} else {
  if (!existsSync(envFile))
    throw new Error(`Crea el perfil con npm run full:env -- ${profile}`);
  Object.assign(env, parseEnv(readFileSync(envFile, "utf8")));
  env.ARVELUNA_FULL_APP = "true";
  if (test) {
    const broker = new URL(env.RABBITMQ_URL);
    if (
      broker.protocol !== "amqp:" ||
      broker.hostname !== "127.0.0.1" ||
      broker.port !== String(brokerPort) ||
      env.GATEWAY_PORT !== "13000" ||
      env.FRONTEND_ORIGIN !== "http://localhost:15173" ||
      env.FULL_MYSQL_PORT !== String(dbPort) ||
      env.FULL_BROKER_PORT !== String(brokerPort) ||
      env.FULL_BROKER_UI_PORT !== "55772" ||
      owners.some(
        (owner) =>
          env[`${owner.toUpperCase()}_PORT`] !==
          String(apps[owner] + apiOffset),
      )
    )
      throw new Error("Puertos fuera del perfil de prueba");
    env.BLOCKCHAIN_PROVIDER = env.PAYMENT_PROVIDER = "simulated";
    env.ARVE_PAYMENT_PROVIDER = "simulated";
    env.ARVE_TRON_NETWORK = "shasta";
    env.ARVE_CONTRACT_ADDRESS = "41000000000000000000000000000000000000abce";
    env.ARVE_TRONGRID_API_KEY = env.TRONGRID_API_KEY = "";
  }
  env.FULL_DATABASE_PREFIX = project.replaceAll("-", "_");
  for (const owner of owners) {
    const raw =
      env[
        owner === "payments"
          ? "DATABASE_URL"
          : `${owner.toUpperCase()}_DATABASE_URL`
      ];
    const url = new URL(raw);
    if (
      url.protocol !== "mysql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== String(dbPort) ||
      url.pathname !== `/${env.FULL_DATABASE_PREFIX}_${owner}` ||
      url.username !== `arv_${owner}`
    )
      throw new Error(`Destino fuera del perfil aislado de ${owner}`);
  }
  if (
    action === "up" ||
    action === "stop" ||
    action === "broker-stop" ||
    action === "broker-start"
  ) {
    const compose = [
      "compose",
      "-f",
      "docker-compose.full-app.yml",
      "-p",
      project,
      "--env-file",
      envFile,
    ];
    const args = {
      up: ["up", "-d", "--wait"],
      stop: ["stop"],
      "broker-stop": ["stop", "rabbitmq"],
      "broker-start": ["up", "-d", "--wait", "rabbitmq"],
    };
    command("docker", [...compose, ...args[action]]);
    if (action === "up") {
      const statements = owners
        .map((owner) => {
          const password = env[`SQL_PASSWORD_${owner.toUpperCase()}`];
          if (!/^[0-9a-f]{64}$/.test(password))
            throw new Error("Contraseña SQL de perfil inválida");
          const database = `\`${env.FULL_DATABASE_PREFIX}_${owner}\``;
          return `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
CREATE USER IF NOT EXISTS 'arv_${owner}'@'%' IDENTIFIED BY '${password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON ${database}.* TO 'arv_${owner}'@'%';`;
        })
        .join("\n");
      const setup = spawnSync(
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
        { env, input: statements, encoding: "utf8" },
      );
      if (setup.status !== 0)
        throw new Error(
          "No se pudieron verificar los esquemas y permisos de MySQL",
        );
    }
  } else if (action === "migrate") {
    useLocalEngines();
    for (const owner of schemas())
      command(process.execPath, [
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
        "--schema",
        schema(owner),
      ]);
  } else if (action === "provision") {
    command(process.execPath, ["--import", "tsx", "scripts/full-provision.ts"]);
  } else if (action === "test") {
    if (!test)
      throw new Error("Las pruebas de escritura requieren perfil test");
    env.TSX_TSCONFIG_PATH = `${process.cwd()}/backend/tsconfig.json`;
    command(process.execPath, [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      "backend/test/full-app/*.test.ts",
    ]);
  } else if (action === "browser") {
    if (!test)
      throw new Error("Las pruebas de navegador requieren perfil test");
    command(process.execPath, [
      "node_modules/@playwright/test/cli.js",
      "test",
      "-c",
      "playwright.full.config.ts",
    ]);
  } else if (action === "frontend") {
    const uiPort = String(5173 + apiOffset);
    const webEnvironment = { ...process.env, GATEWAY_PORT: env.GATEWAY_PORT };
    command("npm", ["run", "css", "-w", "frontend"], webEnvironment);
    command(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "frontend",
        "--host",
        "127.0.0.1",
        "--port",
        uiPort,
        "--strictPort",
      ],
      webEnvironment,
    );
  } else if (action === "dev" || action === "start") {
    const programs = [
      ...schemas().map((owner) => [
        owner,
        owner === "imports"
          ? "import-service"
          : owner === "cash"
            ? "cash-register-service"
            : `${owner}-service`,
      ]),
      ["gateway", "api-gateway"],
    ];
    const databaseVars = [
      "DATABASE_URL",
      ...owners
        .filter((owner) => owner !== "payments")
        .map((owner) => `${owner.toUpperCase()}_DATABASE_URL`),
    ];
    const children = programs
      .filter(([, app]) => existsSync(`backend/apps/${app}/src/main.ts`))
      .map(([owner, app]) => {
        const args =
          action === "dev"
            ? ["--import", "tsx", `backend/apps/${app}/src/main.ts`]
            : [`backend/dist/apps/${app}/src/main.js`];
        const database =
          owner === "payments"
            ? "DATABASE_URL"
            : `${owner.toUpperCase()}_DATABASE_URL`;
        const serviceEnv = Object.fromEntries(
          Object.entries(env).filter(
            ([name]) =>
              (!databaseVars.includes(name) || name === database) &&
              !/^SQL_PASSWORD_|^MYSQL_ROOT_PASSWORD$|^FULL_BROKER_PASSWORD$|^BOOTSTRAP_/.test(
                name,
              ),
          ),
        );
        if (action === "dev")
          serviceEnv.TSX_TSCONFIG_PATH = `${process.cwd()}/backend/tsconfig.json`;
        if (owner !== "payments") {
          delete serviceEnv.TRONGRID_API_KEY;
          delete serviceEnv.ARVE_TRONGRID_API_KEY;
        }
        if (!["payments", "inventory", "sales", "analytics"].includes(owner))
          delete serviceEnv.RABBITMQ_URL;
        return spawn(process.execPath, args, {
          env: serviceEnv,
          stdio: "inherit",
        });
      });
    const close = () => children.forEach((child) => child.kill());
    process.on("SIGTERM", close);
    process.on("SIGINT", close);
    children.forEach((child) =>
      child.on("exit", (code) => {
        if (code) process.exitCode = code;
        close();
      }),
    );
  } else {
    throw new Error("Comando desconocido");
  }
}
