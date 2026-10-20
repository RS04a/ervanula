import { PaymentOrder, PaymentStatus } from "../entities/models";
import { PaymentError } from "../errors/payment-error";
export function toBaseUnits(amount: string): string {
  if (!/^(0|[1-9]\d{0,19})(\.\d{1,6})?$/.test(amount))
    throw new PaymentError(
      "INVALID_REQUEST",
      "Monto decimal inválido",
      false,
      400,
    );
  const [whole, fraction = ""] = amount.split(".");
  const value = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (value <= 0n)
    throw new PaymentError(
      "INVALID_REQUEST",
      "El monto debe ser positivo",
      false,
      400,
    );
  return value.toString();
}
export function transition(order: PaymentOrder, status: PaymentStatus): void {
  const allowed: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ["DETECTED", "REJECTED", "EXPIRED"],
    DETECTED: ["CONFIRMING", "CONFIRMED", "REJECTED", "EXPIRED"],
    CONFIRMING: ["CONFIRMED", "REJECTED", "EXPIRED"],
    CONFIRMED: [],
    REJECTED: [],
    EXPIRED: [],
  };
  if (order.status !== status && !allowed[order.status].includes(status))
    throw new PaymentError(
      "INVALID_REQUEST",
      "La orden está en estado terminal",
      false,
      409,
    );
  order.status = status;
  order.updatedAt = new Date();
  if (status === "CONFIRMED") order.confirmedAt = new Date();
}
