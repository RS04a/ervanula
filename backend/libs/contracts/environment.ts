import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
export function loadEnvironment() {
  if (process.env.ARVELUNA_FULL_APP === "true") return;
  let directory = process.cwd();
  for (;;) {
    const path = join(directory, ".env");
    if (existsSync(path)) {
      config({ path, quiet: true });
      return;
    }
    const parent = dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

export function assertLegacyPaymentsDatabase(value: string | undefined) {
  if (!value) throw new Error("Falta la base histórica de Payments");
  const database = new URL(value);
  if (
    /^\/arveluna_full(?:_|$)/i.test(decodeURIComponent(database.pathname)) ||
    /^arv_payments$/i.test(decodeURIComponent(database.username))
  )
    throw new Error("El perfil histórico de Payments requiere su propia base");
}
export function assertPaymentsEntryMode() {
  if (
    process.env.ARVELUNA_FULL_APP !== "true" &&
    !process.argv.includes("--legacy-payments-demo")
  )
    throw new Error(
      "Usa full:dev/full:start o el comando explícito de la demo histórica",
    );
}
