import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Secrets } from "../application/identity";

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export class NodeSecrets implements Secrets {
  async hash(password: string) {
    const salt = randomBytes(16).toString("hex");
    return `scrypt$v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
  }
  async compare(password: string, hash = "") {
    const valid = /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
    const key = await derive(
      password,
      valid?.[1] ?? "00000000000000000000000000000000",
    );
    return (
      timingSafeEqual(key, Buffer.from(valid?.[2] ?? "00".repeat(64), "hex")) &&
      Boolean(valid)
    );
  }
  issue() {
    return randomBytes(32).toString("hex");
  }
  digest(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
