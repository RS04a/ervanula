import { fault } from "../../../../libs/full-app/contract";

export interface Balance {
  available: number;
  reserved: number;
}
export type StockAction = "reserve" | "consume" | "release";
export function change(
  balance: Balance,
  quantity: number,
  action?: StockAction,
): Balance {
  const available =
    balance.available +
    (action === "reserve" ? -quantity : action === "consume" ? 0 : quantity);
  const reserved =
    balance.reserved +
    (action === "reserve" ? quantity : action ? -quantity : 0);
  if (available < 0 || reserved < 0)
    fault(409, "INSUFFICIENT_STOCK", "Existencias insuficientes");
  if (available + reserved > 1_000_000_000)
    fault(409, "STOCK_LIMIT", "Límite de existencias superado");
  return { available, reserved };
}
