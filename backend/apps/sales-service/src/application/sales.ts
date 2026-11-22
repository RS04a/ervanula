import {
  Actor,
  fault,
  field,
  object,
} from "../../../../libs/full-app/contract";
import { asset, integer, scales } from "../../../../libs/full-app/money";
import type { Event } from "../../../../libs/full-app/events";
import { expectedMethod, Item, Method, Sale, SaleState } from "../domain/sale";

export interface SaleRepository {
  create(actor: Actor, id: string, asset: string, scale: number): Promise<Sale>;
  list(
    merchantId: string,
    offset: number,
    status?: string,
    take?: number,
  ): Promise<Sale[]>;
  get(merchantId: string, id: string): Promise<Sale | null>;
  item(merchantId: string, id: string, item: Item): Promise<Sale>;
  checkout(
    actor: Actor,
    id: string,
    method: Method,
    cashSessionId?: string,
  ): Promise<Sale>;
  cancel(merchantId: string, id: string): Promise<Sale>;
  claim(id?: string): Promise<(Sale & { leaseToken: string }) | null>;
  advance(
    sale: Sale & { leaseToken: string },
    state: SaleState,
    changes?: {
      paymentId?: string;
      paymentNetwork?: string;
      paymentContract?: string;
      exception?: string | null;
    },
  ): Promise<void>;
  defer(sale: Sale & { leaseToken: string }, reason: string): Promise<void>;
  payment(event: Event): Promise<void>;
}
interface CatalogItem extends Omit<Item, "productId" | "quantity"> {
  asset: string;
}
export interface SaleOperations {
  product(merchantId: string, id: string): Promise<CatalogItem>;
  reserve(sale: Sale): Promise<void>;
  opening(sale: Sale): Promise<{
    id: string;
    status: string;
    network: string;
    tokenContract: string;
  }>;
  payment(sale: Sale): Promise<PaymentSnapshot>;
  settle(sale: Sale, action: "consume" | "release"): Promise<void>;
  cashSession(merchantId: string): Promise<string>;
  cash(sale: Sale): Promise<void>;
}
interface PaymentSnapshot {
  id: string;
  saleId: string;
  merchantId: string;
  tokenSymbol: string;
  network: string;
  tokenContract: string;
  amountBaseUnits: string;
  tokenDecimals: number;
  status: string;
  transactionHash: string | null;
  confirmedAt: string | null;
}
export class Sales {
  constructor(
    readonly db: SaleRepository,
    private readonly operations: SaleOperations,
  ) {}
  async get(actor: Actor, id: string) {
    const sale = await this.db.get(actor.merchantId, id);
    if (!sale) fault(404, "NOT_FOUND", "Venta inexistente");
    return sale;
  }
  create(actor: Actor, value: unknown) {
    const body = object(value);
    const currency = asset(body.asset);
    const id = field(body.id, "referencia");
    if (!/^[a-f0-9-]{36}$/.test(id))
      fault(400, "INVALID_ID", "Usa un identificador de operación");
    return this.db.create(actor, id, currency, scales[currency]);
  }
  async item(actor: Actor, id: string, value: unknown) {
    const sale = await this.get(actor, id);
    const body = object(value);
    const productId = field(body.productId, "producto");
    const quantity = integer(body.quantity, "cantidad");
    if (!quantity)
      return this.db.item(actor.merchantId, id, {
        productId,
        quantity,
        sku: "",
        description: "",
        priceBase: "0",
        scale: sale.scale,
      });
    const product = await this.operations.product(actor.merchantId, productId);
    if (product.asset !== sale.asset || product.scale !== sale.scale)
      fault(409, "ASSET_MISMATCH", "Cada venta usa un solo activo");
    return this.db.item(actor.merchantId, id, {
      productId,
      quantity,
      sku: product.sku,
      description: product.description,
      priceBase: product.priceBase,
      scale: product.scale,
    });
  }
  async checkout(actor: Actor, id: string) {
    const sale = await this.get(actor, id);
    if (sale.status !== "DRAFT") return sale;
    const method = expectedMethod(asset(sale.asset));
    const session =
      method === "CASH"
        ? await this.operations.cashSession(actor.merchantId)
        : undefined;
    return this.db.checkout(actor, id, method, session);
  }
  async receive(message: Event) {
    const { data, topic, merchantId, correlationId } = message;
    if (typeof data.saleId !== "string" || data.saleId !== correlationId)
      throw new Error("Referencia de venta inválida");
    const sale = await this.db.get(merchantId, data.saleId);
    if (!sale?.paymentId || sale.paymentId !== data.orderId)
      throw new Error("Checkout pendiente o incompatible");
    const order = await this.operations.payment(sale);
    const matches =
      order.id === data.orderId &&
      order.saleId === data.saleId &&
      order.merchantId === merchantId &&
      order.tokenSymbol === data.asset &&
      order.network === data.network &&
      order.tokenContract === data.contract &&
      order.amountBaseUnits === data.amountBase &&
      order.tokenDecimals === data.scale;
    const moneyReceived = Boolean(
      order.confirmedAt &&
      order.transactionHash &&
      order.transactionHash === data.transactionHash,
    );
    const allowed =
      topic === "payment.confirmed.v1"
        ? order.status === "CONFIRMED" && moneyReceived
        : topic === "payment.expired.v1"
          ? order.status === "EXPIRED"
          : topic === "payment.late.v1" &&
            ["EXPIRED", "REJECTED"].includes(order.status) &&
            moneyReceived;
    if (!matches || !allowed)
      throw new Error("Evento sin respaldo en Payments");
    await this.db.payment(message);
  }
  async step(id?: string) {
    const sale = await this.db.claim(id);
    if (!sale) return false;
    const advance = (
      state: SaleState,
      changes?: {
        paymentId?: string;
        paymentNetwork?: string;
        paymentContract?: string;
        exception?: string | null;
      },
    ) => this.db.advance(sale, state, { exception: null, ...changes });
    try {
      switch (sale.status) {
        case "RESERVING":
          await this.operations.reserve(sale);
          await advance(
            sale.method === "CASH" ? "RECORDING_CASH" : "OPENING_PAYMENT",
          );
          break;
        case "OPENING_PAYMENT": {
          const order = await this.operations.opening(sale);
          await advance("AWAITING_PAYMENT", {
            paymentId: order.id,
            paymentNetwork: order.network,
            paymentContract: order.tokenContract,
          });
          break;
        }
        case "RECORDING_CASH":
          await this.operations.cash(sale);
          await advance("PAYMENT_CONFIRMED");
          break;
        case "AWAITING_PAYMENT": {
          const payment = await this.operations.payment(sale);
          if (payment.status === "REJECTED")
            await advance("RELEASING", { exception: "PAYMENT_REJECTED" });
          else await this.db.defer(sale, "");
          break;
        }
        case "PAYMENT_CONFIRMED":
          await this.operations.settle(sale, "consume");
          await advance("INVENTORY_CONSUMED");
          break;
        case "INVENTORY_CONSUMED":
          if (sale.method === "TRC20") await this.operations.cash(sale);
          await advance("COMPLETED");
          break;
        case "RELEASING":
          await this.operations.settle(sale, "release");
          await advance(
            sale.exception === "LATE_PAYMENT" ? "REVIEW" : "CANCELLED",
            { exception: sale.exception },
          );
          break;
      }
    } catch (error) {
      const failure = error as { code?: string; retryable?: boolean };
      const code = failure.code ?? "RETRY_PENDING";
      if (failure.retryable) {
        await this.db.defer(sale, code);
        return true;
      }
      if (
        sale.status === "RESERVING" &&
        ["INSUFFICIENT_STOCK", "INACTIVE_PRODUCT", "NOT_FOUND"].includes(code)
      )
        await advance("CANCELLED", { exception: code });
      else if (
        sale.status === "OPENING_PAYMENT" &&
        [
          "WALLET_MISSING",
          "WALLET_CONTRACT_COLLISION",
          "PROFILE_MISSING",
          "INVALID_AMOUNT",
        ].includes(code)
      )
        await advance("RELEASING", { exception: code });
      else if (sale.status === "RECORDING_CASH" && code === "CASH_CLOSED")
        await advance("RELEASING", { exception: code });
      else await this.db.defer(sale, code);
    }
    return true;
  }
}
