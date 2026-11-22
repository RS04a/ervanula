import { normalizeTronAddress as canonicalAddress } from "../../../../../libs/full-app/tron-address";
import { PaymentError } from "../errors/payment-error";
function invalid(): never {
  throw new PaymentError("INVALID_TRANSACTION_DATA", "Dirección TRON inválida");
}
export function normalizeTronAddress(value: string): string {
  try {
    return canonicalAddress(value);
  } catch {
    return invalid();
  }
}
/** ABI indexed address: strict 12 zero padding bytes + 20 address bytes. */
export function tronAddressFromTopic(value: string): string {
  if (typeof value !== "string" || !/^0{24}[a-fA-F0-9]{40}$/.test(value))
    return invalid();
  return normalizeTronAddress(value.slice(24));
}
