import { fault } from "../../../../libs/full-app/contract";

export function expected(prior: string, amount: string, kind: string) {
  const next = BigInt(prior) + BigInt(amount) * (kind === "OUT" ? -1n : 1n);
  if (next < 0n)
    fault(409, "CASH_INSUFFICIENT", "El egreso supera el efectivo disponible");
  return next.toString();
}
