import {
  Actor,
  fault,
  field,
  object,
  requireAdmin,
} from "../../../../libs/full-app/contract";
import {
  Asset,
  asset,
  baseUnits,
  integer,
  scales,
} from "../../../../libs/full-app/money";
import type { StockAction } from "../domain/stock";

export interface ProductInput {
  sku: string;
  description: string;
  asset: Asset;
  priceBase: string;
  scale: number;
  minimum: number;
}
export interface StockItem {
  productId: string;
  quantity: number;
}
export interface Movement {
  productId: string;
  reference: string;
  reason: string;
  quantity: number;
  kind: "IN" | "OUT" | "ADJUST";
}
export interface InventoryRepository {
  list(
    merchantId: string,
    offset: number,
    search: string,
    take?: number,
  ): Promise<unknown>;
  movements(
    merchantId: string,
    offset: number,
    productId?: string,
    take?: number,
  ): Promise<unknown>;
  product(
    merchantId: string,
    id: string,
  ): Promise<(ProductInput & { id: string; active: boolean }) | null>;
  create(merchantId: string, product: ProductInput): Promise<unknown>;
  edit(
    merchantId: string,
    id: string,
    product: ProductInput | null,
  ): Promise<unknown>;
  move(actor: Actor, movement: Movement): Promise<unknown>;
  reserve(
    merchantId: string,
    saleId: string,
    items: StockItem[],
  ): Promise<unknown>;
  settle(
    actor: Actor,
    saleId: string,
    action: Exclude<StockAction, "reserve">,
  ): Promise<unknown>;
  applyImport(
    actor: Actor,
    reference: string,
    product: ProductInput,
    quantity: number,
  ): Promise<unknown>;
}
export function productInput(input: unknown): ProductInput {
  const body = object(input);
  const sku = field(body.sku, "SKU", 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku))
    fault(400, "INVALID_SKU", "SKU inválido");
  const currency = asset(body.asset);
  const priceBase = baseUnits(body.price, currency);
  if (priceBase === "0")
    fault(400, "INVALID_PRICE", "El precio debe ser positivo");
  return {
    sku,
    description: field(body.description, "descripción"),
    asset: currency,
    priceBase,
    scale: scales[currency],
    minimum: integer(body.minimum, "mínimo"),
  };
}
export class Inventory {
  constructor(readonly db: InventoryRepository) {}
  create(actor: Actor, input: unknown) {
    requireAdmin(actor);
    return this.db.create(actor.merchantId, productInput(input));
  }
  edit(actor: Actor, id: string, input: unknown) {
    requireAdmin(actor);
    return this.db.edit(
      actor.merchantId,
      id,
      input === null ? null : productInput(input),
    );
  }
  move(actor: Actor, input: unknown) {
    requireAdmin(actor);
    const body = object(input);
    const kind = body.kind;
    if (kind !== "IN" && kind !== "OUT" && kind !== "ADJUST")
      fault(400, "INVALID_MOVEMENT", "Tipo de movimiento inválido");
    const quantity = integer(
      body.quantity,
      "movimiento",
      kind === "ADJUST" ? -1_000_000 : 1,
    );
    if (!quantity)
      fault(
        400,
        "INVALID_MOVEMENT",
        "El movimiento debe cambiar las existencias",
      );
    return this.db.move(actor, {
      productId: field(body.productId, "producto"),
      reference: field(body.reference, "referencia"),
      reason: field(body.reason, "motivo"),
      quantity: kind === "OUT" ? -quantity : quantity,
      kind,
    });
  }
  reserve(merchantId: string, saleId: string, value: unknown) {
    if (!Array.isArray(value) || !value.length || value.length > 100)
      fault(
        400,
        "INVALID_ITEMS",
        "La reserva requiere entre 1 y 100 productos",
      );
    const items = value.map((item) => {
      const body = object(item);
      return {
        productId: field(body.productId, "producto"),
        quantity: integer(body.quantity, "reserva", 1),
      };
    });
    if (new Set(items.map((item) => item.productId)).size !== items.length)
      fault(400, "INVALID_ITEMS", "Productos duplicados en reserva");
    return this.db.reserve(merchantId, saleId, items);
  }
  import(actor: Actor, reference: string, input: unknown) {
    const body = object(input);
    return this.db.applyImport(
      actor,
      reference,
      productInput(body),
      integer(body.quantity, "entrada"),
    );
  }
}
