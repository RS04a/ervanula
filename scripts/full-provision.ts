import { PrismaIdentity } from "../backend/apps/identity-service/src/infrastructure/prisma";
import { PrismaMerchants } from "../backend/apps/merchant-service/src/infrastructure/prisma";
import { Identity } from "../backend/apps/identity-service/src/application/identity";
import { NodeSecrets } from "../backend/apps/identity-service/src/infrastructure/secrets";

async function main() {
  const {
    BOOTSTRAP_EMAIL,
    BOOTSTRAP_PASSWORD,
    BOOTSTRAP_MERCHANT_ID,
    BOOTSTRAP_MERCHANT_NAME,
  } = process.env;
  if (
    !BOOTSTRAP_EMAIL ||
    !BOOTSTRAP_PASSWORD ||
    !BOOTSTRAP_MERCHANT_NAME ||
    !BOOTSTRAP_MERCHANT_ID ||
    !/^[a-z0-9-]{3,48}$/.test(BOOTSTRAP_MERCHANT_ID) ||
    BOOTSTRAP_MERCHANT_NAME.length > 120
  )
    throw new Error("Completa los campos BOOTSTRAP del perfil privado");
  const id = new PrismaIdentity();
  const merchant = new PrismaMerchants();
  try {
    const identity = new Identity(id, new NodeSecrets());
    const existing = await id.credentials(BOOTSTRAP_EMAIL.trim().toLowerCase());
    if (
      existing &&
      (existing.merchantId !== BOOTSTRAP_MERCHANT_ID ||
        existing.role !== "ADMIN")
    )
      throw new Error("Identidad existente incompatible con el comercio");
    await merchant.db.merchant.upsert({
      where: { id: BOOTSTRAP_MERCHANT_ID },
      create: { id: BOOTSTRAP_MERCHANT_ID, name: BOOTSTRAP_MERCHANT_NAME },
      update: {},
    });
    if (!existing)
      await identity.create(
        BOOTSTRAP_MERCHANT_ID,
        {
          email: BOOTSTRAP_EMAIL,
          password: BOOTSTRAP_PASSWORD,
          displayName: "Administrador",
        },
        "ADMIN",
      );
    console.log("Comercio y administrador disponibles.");
  } finally {
    await Promise.all([id.onModuleDestroy(), merchant.onModuleDestroy()]);
  }
}
void main().catch(() => {
  console.error(
    "Inicialización rechazada. Revisa perfil, datos y migraciones.",
  );
  process.exitCode = 1;
});
