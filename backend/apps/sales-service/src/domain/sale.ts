import { fault } from "../../../../libs/full-app/contract";
import type { Asset } from "../../../../libs/full-app/money";

export type SaleState =
  | "DRAFT"
  | "RESERVING"
  | "OPENING_PAYMENT"
  | "AWAITING_PAYMENT"
  | "RECORDING_CASH"
  | "PAYMENT_CONFIRMED"
  | "INVENTORY_CONSUMED"
  | "RELEASING"
  | "COMPLETED"
  | "CANCELLED"
  | "REVIEW";
export type Method = "CASH" | "TRC20";
export interface Item {
  productId: string;
  sku: string;
  description: string;
  priceBase: string;
  scale: number;
  quantity: number;
}
export interface Sale {
  id: string;
  merchantId: string;
  userId: string;
  asset: string;
  scale: number;
  status: string;
  totalBase: string;
  method: string | null;
  paymentId: string | null;
  cashSessionId: string | null;
  exception: string | null;
  items: Item[];
}
export function expectedMethod(asset: Asset): Method {
  return asset === "COP" ? "CASH" : "TRC20";
}
export function total(items: Item[]) {
  return items
    .reduce(
      (sum, item) => sum + BigInt(item.priceBase) * BigInt(item.quantity),
      0n,
    )
    .toString();
}
export function assertDraft(sale: Sale) {
  if (sale.status !== "DRAFT")
    fault(409, "SALE_LOCKED", "La venta ya inició el cobro");
}
