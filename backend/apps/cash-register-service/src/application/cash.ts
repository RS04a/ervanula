import {
  Actor,
  fault,
  field,
  object,
  requireAdmin,
} from "../../../../libs/full-app/contract";
import { asset, baseUnits } from "../../../../libs/full-app/money";

export interface CashEntry {
  userId: string;
  merchantId: string;
  reference: string;
  kind: string;
  asset: string;
  amountBase: string;
  reason: string;
  saleId?: string;
  paymentId?: string;
}
export interface CashRepository {
  register(merchantId: string): Promise<unknown>;
  sessions(merchantId: string, offset: number, take?: number): Promise<unknown>;
  movements(
    merchantId: string,
    offset: number,
    asset?: string,
  ): Promise<unknown>;
  open(actor: Actor, reference: string, amount: string): Promise<unknown>;
  close(
    actor: Actor,
    id: string,
    reference: string,
    amount: string,
  ): Promise<unknown>;
  record(entry: CashEntry, sessionId?: string): Promise<unknown>;
}
export class CashRegister {
  constructor(readonly db: CashRepository) {}
  open(actor: Actor, input: unknown) {
    const value = object(input);
    return this.db.open(
      actor,
      field(value.reference, "referencia"),
      baseUnits(value.amount, "COP"),
    );
  }
  close(actor: Actor, input: unknown) {
    const value = object(input);
    return this.db.close(
      actor,
      field(value.sessionId, "sesión de caja"),
      field(value.reference, "referencia"),
      baseUnits(value.amount, "COP"),
    );
  }
  manual(actor: Actor, input: unknown) {
    requireAdmin(actor);
    const value = object(input);
    if (value.kind !== "IN" && value.kind !== "OUT")
      fault(400, "INVALID_MOVEMENT", "Tipo de movimiento inválido");
    const amountBase = baseUnits(value.amount, "COP");
    if (amountBase === "0")
      fault(400, "INVALID_AMOUNT", "El monto debe ser positivo");
    return this.db.record(
      {
        merchantId: actor.merchantId,
        userId: actor.userId,
        reference: `manual:${field(value.reference, "referencia")}`,
        kind: value.kind,
        asset: "COP",
        amountBase,
        reason: field(value.reason, "motivo"),
      },
      field(value.sessionId, "sesión de caja"),
    );
  }
  settle(input: unknown) {
    const value = object(input);
    const currency = asset(value.asset);
    const digital = value.method === "TRC20";
    if (
      digital
        ? currency === "COP"
        : value.method !== "CASH" || currency !== "COP"
    )
      fault(400, "INVALID_SETTLEMENT", "Medio y activo incompatibles");
    const amountBase = field(value.totalBase, "monto", 64);
    if (!/^[1-9]\d*$/.test(amountBase))
      fault(400, "INVALID_AMOUNT", "Monto inválido");
    const saleId = field(value.saleId, "venta");
    return this.db.record(
      {
        merchantId: field(value.merchantId, "comercio"),
        userId: field(value.userId, "usuario"),
        saleId,
        paymentId: digital
          ? field(value.paymentId, "orden de pago")
          : undefined,
        reference: `sale:${saleId}`,
        kind: digital ? "DIGITAL_SALE" : "CASH_SALE",
        asset: currency,
        amountBase,
        reason: digital ? "Pago TRC-20" : "Cobro en efectivo",
      },
      digital ? undefined : field(value.sessionId, "sesión de caja"),
    );
  }
}
