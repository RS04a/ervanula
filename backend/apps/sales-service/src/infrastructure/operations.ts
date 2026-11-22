import { call } from "../../../../libs/full-app/service-http";
import { decimal } from "../../../../libs/full-app/money";
import type { SaleOperations } from "../application/sales";
import type { Sale } from "../domain/sale";

const post = (body: unknown) => ({ method: "POST", body });
export class HttpSaleOperations implements SaleOperations {
  product(
    merchantId: string,
    id: string,
  ): ReturnType<SaleOperations["product"]> {
    return call(
      "sales",
      "inventory",
      `inventory/catalog/${encodeURIComponent(merchantId)}/${encodeURIComponent(id)}`,
    );
  }
  async reserve(sale: Sale) {
    await call(
      "sales",
      "inventory",
      `inventory/reservations/${sale.merchantId}/${sale.id}`,
      post({
        items: sale.items.map(({ productId, quantity }) => ({
          productId,
          quantity,
        })),
      }),
    );
  }
  opening(sale: Sale): ReturnType<SaleOperations["opening"]> {
    return call(
      "sales",
      "payments",
      "payments/checkout",
      post({
        merchantId: sale.merchantId,
        saleId: sale.id,
        asset: sale.asset,
        amount: decimal(sale.totalBase, sale.scale),
      }),
    );
  }
  payment(sale: Sale): ReturnType<SaleOperations["payment"]> {
    return call(
      "sales",
      "payments",
      `payments/checkout/${sale.merchantId}/${sale.paymentId}`,
    );
  }
  async settle(sale: Sale, action: "consume" | "release") {
    await call(
      "sales",
      "inventory",
      `inventory/reservations/${sale.merchantId}/${sale.id}/${action}`,
      post({ userId: sale.userId }),
    );
  }
  async cashSession(merchantId: string) {
    const response = await call<{ id: string }>(
      "sales",
      "cash",
      `cash/active/${merchantId}`,
    );
    return response.id;
  }
  async cash(sale: Sale) {
    await call(
      "sales",
      "cash",
      "cash/settlement",
      post({
        merchantId: sale.merchantId,
        saleId: sale.id,
        userId: sale.userId,
        paymentId: sale.paymentId,
        sessionId: sale.cashSessionId,
        asset: sale.asset,
        totalBase: sale.totalBase,
        method: sale.method,
      }),
    );
  }
}
