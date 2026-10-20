import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env existente conservado. No se modificó ningún valor.");
} else {
  const password = randomBytes(24).toString("hex");
  const rootPassword = randomBytes(24).toString("hex");
  const template = readFileSync(".env.example", "utf8")
    .replace(/^MYSQL_PASSWORD=.*$/m, `MYSQL_PASSWORD=${password}`)
    .replace(/^MYSQL_ROOT_PASSWORD=.*$/m, `MYSQL_ROOT_PASSWORD=${rootPassword}`)
    .replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=mysql://arveluna:${password}@localhost:3306/arveluna_payments`,
    );
  writeFileSync(".env", template, { flag: "wx", mode: 0o600 });
  console.log(
    ".env local creado con contraseñas aleatorias. No lo incluyas en Git ni en la entrega.",
  );
}
