import { Buffer } from "node:buffer";

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { parseEnv } from "node:util";

const desktopGit =
  "/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git";
const final = "ARVELUNA_App_Completa.zip";
const manifest = "docs/full-app/entrega/MANIFIESTO.txt";
const staged = process.argv.includes("--check-staged");
const profilePaths = readdirSync(".").filter(
  (name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example",
);
const required = [
  "README.md",
  "package-lock.json",
  "docs/full-app/PROGRESO.md",
  "docs/full-app/CIERRE_AUDITADO.md",

  "docs/full-app/entrega/ARVELUNA_Informe_Tecnico.pdf",
  "docs/full-app/entrega/ARVELUNA_Defensa.pdf",
  "docs/full-app/entrega/ARVELUNA_Defensa.pptx",
  "docs/full-app/capturas/escritorio-dashboard.png",
  "docs/full-app/capturas/movil-dashboard.png",
];
const excluded =
  /(?:^|\/)(?:\.git|node_modules|dist|coverage|test-results|playwright-report|\.DS_Store)(?:\/|$)|(?:^|\/)\.env(?:$|\.(?!example$))|\.(?:pem|key|sqlite|log|zip)$/i;
const invoke = (program, args, options = {}) =>
  spawnSync(program, args, {
    encoding: "utf8",
    maxBuffer: 10_000_000,
    ...options,
  });
const git =
  process.env.GIT_BIN || (existsSync(desktopGit) ? desktopGit : "git");
const result = invoke(
  git,
  staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
);
if (result.status !== 0)
  throw new Error("No se pudo enumerar el árbol Git de la entrega");
const discovered = [...new Set(result.stdout.split("\0").filter(Boolean))];
if (staged && discovered.some((path) => excluded.test(path)))
  throw new Error("El índice contiene un archivo excluido del paquete");
const paths = discovered.filter(
  (path) =>
    !excluded.test(path) &&
    (staged || (existsSync(path) && lstatSync(path).isFile())),
);
if (!staged) {
  for (const name of required)
    if (!paths.includes(name))
      throw new Error(`Falta artefacto de entrega: ${name}`);
  if (!paths.includes(manifest)) paths.push(manifest);
}
paths.sort();
if (!staged) writeFileSync(manifest, paths.join("\n") + "\n");
const secrets = profilePaths.flatMap((path) =>
  Object.entries(parseEnv(readFileSync(path, "utf8")))
    .filter(
      ([key, value]) =>
        /(?:PASSWORD|_KEY|_TOKEN)$|^SERVICE_KEY_|^SQL_PASSWORD_/.test(key) &&
        value.length >= 12,
    )
    .map(([, value]) => Buffer.from(value)),
);
for (const path of paths) {
  if (path.includes("\n")) throw new Error("Ruta de distribución inválida");
  const read = staged
    ? invoke(git, ["show", `:${path}`], { encoding: "buffer" })
    : null;
  if (read && read.status !== 0)
    throw new Error(`No se pudo leer el blob preparado: ${path}`);
  const content = read?.stdout ?? readFileSync(path);
  const text = content.toString("utf8");
  if (
    secrets.some((secret) => content.includes(secret)) ||
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,}/.test(
      text,
    )
  )
    throw new Error(`El paquete contiene una credencial en ${path}`);
}
if (staged) {
  console.log(
    `Escaneo limitado: ${paths.length} archivos preparados sin incidencias.`,
  );
  process.exit(0);
}
const temporary = mkdtempSync(join(tmpdir(), "arveluna-pack-"));
try {
  const archive = join(temporary, final);
  const packed = invoke("zip", ["-X", "-q", archive, "-@"], {
    input: paths.join("\n") + "\n",
  });
  if (packed.status !== 0) throw new Error("Falló la creación del ZIP");
  const listing = invoke("unzip", ["-Z", "-1", archive]);
  const integrity = invoke("unzip", ["-tq", archive]);
  if (
    listing.status !== 0 ||
    integrity.status !== 0 ||
    JSON.stringify(listing.stdout.trimEnd().split("\n").sort()) !==
      JSON.stringify(paths)
  )
    throw new Error("Manifest o integridad ZIP incorrectos");
  copyFileSync(archive, final);
  console.log(`${final} · ${paths.length} archivos verificados`);
} finally {
  rmSync(temporary, { force: true, recursive: true });
}
