import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
export function loadEnvironment() {
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
