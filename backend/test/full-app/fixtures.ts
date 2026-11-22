import { randomBytes, randomUUID } from "node:crypto";
import { PrismaIdentity } from "../../apps/identity-service/src/infrastructure/prisma";
import { PrismaMerchants } from "../../apps/merchant-service/src/infrastructure/prisma";
import { Identity } from "../../apps/identity-service/src/application/identity";
import { NodeSecrets } from "../../apps/identity-service/src/infrastructure/secrets";

export function validateTestProfile() {
  if (
    process.env.ARVELUNA_FULL_APP !== "true" ||
    process.env.GATEWAY_PORT !== "13000" ||
    process.env.FRONTEND_ORIGIN !== "http://localhost:15173"
  )
    throw new Error("El perfil aislado full-test es obligatorio");
  for (const owner of [
    "identity",
    "merchant",
    "inventory",
    "sales",
    "cash",
    "payments",
    "imports",
    "analytics",
  ]) {
    const variable =
      owner === "payments"
        ? "DATABASE_URL"
        : `${owner.toUpperCase()}_DATABASE_URL`;
    const url = new URL(process.env[variable] ?? "");
    if (
      url.protocol !== "mysql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "43376" ||
      url.pathname !== `/arveluna_full_test_${owner}` ||
      url.username !== `arv_${owner}`
    )
      throw new Error(`Base de pruebas inválida para ${owner}`);
  }
  const broker = new URL(process.env.RABBITMQ_URL ?? "");
  if (
    broker.protocol !== "amqp:" ||
    broker.hostname !== "127.0.0.1" ||
    broker.port !== "45772"
  )
    throw new Error("Broker de pruebas inválido");
}
export async function merchantFixture() {
  validateTestProfile();
  const merchantId = `test-${randomUUID().slice(0, 12)}`;
  const email = `${merchantId}@example.test`;
  const password = randomBytes(20).toString("hex");
  const db = new PrismaIdentity();
  const merchants = new PrismaMerchants();
  try {
    await merchants.db.merchant.create({
      data: { id: merchantId, name: `Comercio ${merchantId}` },
    });
    await new Identity(db, new NodeSecrets()).create(
      merchantId,
      { email, password, displayName: "Administración de prueba" },
      "ADMIN",
    );
  } finally {
    await Promise.all([db.onModuleDestroy(), merchants.onModuleDestroy()]);
  }
  return { merchantId, email, password };
}
