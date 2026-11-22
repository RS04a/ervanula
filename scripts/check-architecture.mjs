import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(join(directory, entry.name))
        : [join(directory, entry.name)],
    )
    .filter((path) => path.endsWith(".ts"));
}
const owners = readdirSync("backend/apps").filter((name) =>
  name.endsWith("-service"),
);
for (const owner of owners) {
  const sourceRoot = `backend/apps/${owner}/src`;
  for (const path of [
    ...files(`${sourceRoot}/domain`),
    ...files(`${sourceRoot}/application`),
  ]) {
    const source = readFileSync(path, "utf8");
    if (
      /(?:from|import)\s*["'](?:@nestjs|@prisma|axios|express|dotenv)|process\.env|from\s*["'][^"']*(?:infrastructure|presentation)/.test(
        source,
      )
    )
      throw new Error(`Dependencia prohibida: ${path}`);
    if (
      path.includes("/domain/") &&
      /from\s*["'][^"']*application/.test(source)
    )
      throw new Error(`Dominio depende de aplicación: ${path}`);
  }
  for (const path of files(sourceRoot)) {
    const source = readFileSync(path, "utf8");
    for (const other of owners.filter((name) => name !== owner))
      if (new RegExp(`from\\s*["'][^"']*\\b${other}/`).test(source))
        throw new Error(`Importación entre servicios: ${path}`);
  }
}
for (const path of files("backend/apps/api-gateway/src"))
  if (/@prisma|payments-service|DATABASE_URL/.test(readFileSync(path, "utf8")))
    throw new Error(`Gateway viola aislamiento: ${path}`);
console.log("Clean Architecture y aislamiento del Gateway: OK");
