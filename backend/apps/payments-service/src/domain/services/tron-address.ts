import { createHash, timingSafeEqual } from "node:crypto";
import { PaymentError } from "../errors/payment-error";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const checksum = (data: Buffer) =>
  createHash("sha256")
    .update(createHash("sha256").update(data).digest())
    .digest()
    .subarray(0, 4);
function invalid(): never {
  throw new PaymentError("INVALID_TRANSACTION_DATA", "Dirección TRON inválida");
}
/** Canonical Base58Check; accepts TRON hex (41 + 20 bytes), EVM hex or Base58Check. */
export function normalizeTronAddress(value: string): string {
  if (typeof value !== "string") return invalid();
  let payload: Buffer;
  const hex = value.replace(/^0x/i, "");
  if (/^(?:41)?[a-fA-F0-9]{40}$/.test(hex))
    payload = Buffer.from(hex.length === 40 ? "41" + hex : hex, "hex");
  else {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) return invalid();
    let integer = 0n;
    for (const char of value)
      integer = integer * 58n + BigInt(alphabet.indexOf(char));
    let bytes = integer.toString(16);
    if (bytes.length % 2) bytes = "0" + bytes;
    const decoded = Buffer.from(bytes, "hex");
    if (decoded.length !== 25 || decoded[0] !== 0x41) return invalid();
    payload = decoded.subarray(0, 21);
    if (!timingSafeEqual(checksum(payload), decoded.subarray(21)))
      return invalid();
  }
  let integer = BigInt(
    "0x" + Buffer.concat([payload, checksum(payload)]).toString("hex"),
  );
  let result = "";
  while (integer > 0n) {
    result = alphabet[Number(integer % 58n)] + result;
    integer /= 58n;
  }
  return result;
}
/** ABI indexed address: strict 12 zero padding bytes + 20 address bytes. */
export function tronAddressFromTopic(value: string): string {
  if (typeof value !== "string" || !/^0{24}[a-fA-F0-9]{40}$/.test(value))
    return invalid();
  return normalizeTronAddress(value.slice(24));
}
