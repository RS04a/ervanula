import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@arveluna/sales-db";
import { Actor, fault } from "../../../../libs/full-app/contract";
import { Event, event } from "../../../../libs/full-app/events";
import { SaleRepository } from "../application/sales";
import {
  assertDraft,
  Item,
  Method,
  Sale,
  SaleState,
  total,
} from "../domain/sale";

type Tx = Prisma.TransactionClient;
const outstanding: SaleState[] = [
  "RESERVING",
  "OPENING_PAYMENT",
  "AWAITING_PAYMENT",
  "RECORDING_CASH",
  "PAYMENT_CONFIRMED",
  "INVENTORY_CONSUMED",
  "RELEASING",
];
async function lock(tx: Tx, merchantId: string, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM Sale WHERE merchantId = ${merchantId} AND id = ${id} FOR UPDATE`;
  if (!rows.length) fault(404, "NOT_FOUND", "Venta inexistente");
  return tx.sale.findUniqueOrThrow({ where: { id }, include: { items: true } });
}
export class PrismaSales implements SaleRepository {
  constructor(
    readonly db = new PrismaClient(),
    private readonly clock = () => new Date(),
  ) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  async create(actor: Actor, localId: string, asset: string, scale: number) {
    const id = `${actor.merchantId}-${localId}`;
    const sale = await this.db.sale.upsert({
      where: { id },
      create: {
        id,
        merchantId: actor.merchantId,
        userId: actor.userId,
        asset,
        scale,
        status: "DRAFT",
      },
      update: {},
      include: { items: true },
    });
    if (sale.asset !== asset)
      fault(
        409,
        "REFERENCE_CONFLICT",
        "La referencia corresponde a otro activo",
      );
    return sale;
  }
  list(merchantId: string, skip: number, status?: string, take = 25) {
    return this.db.sale.findMany({
      where: { merchantId, status },
      include: { items: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }
  get(merchantId: string, id: string) {
    return this.db.sale.findFirst({
      where: { merchantId, id },
      include: { items: true },
    });
  }
  item(merchantId: string, id: string, item: Item) {
    return this.db.$transaction(
      async (tx) => {
        const sale = await lock(tx, merchantId, id);
        assertDraft(sale);
        const key = { saleId: id, productId: item.productId };
        if (item.quantity) {
          if (
            sale.items.length >= 100 &&
            !sale.items.some((entry) => entry.productId === item.productId)
          )
            fault(409, "ITEM_LIMIT", "Límite de 100 artículos");
          await tx.saleItem.upsert({
            where: { saleId_productId: key },
            create: { ...item, saleId: id },
            update: item,
          });
        } else await tx.saleItem.deleteMany({ where: key });
        const items = await tx.saleItem.findMany({ where: { saleId: id } });
        return tx.sale.update({
          where: { id },
          data: { totalBase: total(items) },
          include: { items: true },
        });
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  checkout(actor: Actor, id: string, method: Method, cashSessionId?: string) {
    return this.db.$transaction(
      async (tx) => {
        const sale = await lock(tx, actor.merchantId, id);
        if (sale.status !== "DRAFT") return sale;
        if (!sale.items.length)
          fault(409, "EMPTY_SALE", "Agrega artículos a la venta");
        return tx.sale.update({
          where: { id },
          data: {
            status: "RESERVING",
            method,
            cashSessionId,
            userId: actor.userId,
          },
          include: { items: true },
        });
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  cancel(merchantId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        const sale = await lock(tx, merchantId, id);
        if (sale.status === "CANCELLED") return sale;
        if (sale.status !== "DRAFT")
          fault(
            409,
            "CANCEL_UNSAFE",
            "Una venta en cobro conserva la reserva hasta resolver el pago",
          );
        return tx.sale.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: { items: true },
        });
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  async claim(id?: string) {
    return this.db.$transaction(
      async (tx) => {
        const now = this.clock();
        const row = await tx.sale.findFirst({
          where: {
            id,
            status: { in: outstanding },
            AND: [
              { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
              { OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
            ],
          },
          orderBy: { updatedAt: "asc" },
          include: { items: true },
        });
        if (!row) return null;
        const leaseToken = randomUUID();
        const result = await tx.sale.updateMany({
          where: { id: row.id, status: row.status, leaseToken: row.leaseToken },
          data: { leaseToken, leaseUntil: new Date(+now + 45_000) },
        });
        return result.count ? { ...row, leaseToken } : null;
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  async advance(
    sale: Sale & { leaseToken: string },
    state: SaleState,
    changes?: {
      paymentId?: string;
      paymentNetwork?: string;
      paymentContract?: string;
      exception?: string | null;
    },
  ) {
    await this.db.$transaction(async (tx) => {
      const completedAt = state === "COMPLETED" ? new Date() : undefined;
      const updated = await tx.sale.updateMany({
        where: {
          id: sale.id,
          status: sale.status,
          leaseToken: sale.leaseToken,
        },
        data: {
          ...changes,
          status: state,
          completedAt,
          leaseToken: null,
          leaseUntil: null,
          retryAt: null,
        },
      });
      if (updated.count && completedAt) {
        const message = event("sale.completed.v1", sale.merchantId, sale.id, {
          saleId: sale.id,
          asset: sale.asset,
          amountBase: sale.totalBase,
          scale: sale.scale,
        });
        await tx.outbox.create({
          data: { id: message.eventId, topic: message.topic, payload: message },
        });
      }
    });
  }
  async defer(sale: Sale & { leaseToken: string }, reason: string) {
    await this.db.sale.updateMany({
      where: { id: sale.id, status: sale.status, leaseToken: sale.leaseToken },
      data: {
        exception:
          sale.status === "RELEASING" ? sale.exception : reason || null,
        leaseToken: null,
        leaseUntil: null,
        retryAt: new Date(Date.now() + 3000),
      },
    });
  }
  async payment(message: Event) {
    const { merchantId, eventId, topic, data } = message;
    if (
      ![
        "payment.confirmed.v1",
        "payment.expired.v1",
        "payment.late.v1",
      ].includes(topic) ||
      typeof data.saleId !== "string"
    )
      throw new Error("Evento de pago inválido");
    await this.db.$transaction(
      async (tx) => {
        const saleId = String(data.saleId);
        const sale = await lock(tx, merchantId, saleId);
        if (await tx.processedEvent.findUnique({ where: { eventId } })) return;
        if (
          !sale.paymentId ||
          sale.paymentId !== data.orderId ||
          sale.method !== "TRC20" ||
          sale.asset !== data.asset ||
          sale.paymentNetwork !== data.network ||
          sale.paymentContract !== data.contract ||
          sale.totalBase !== data.amountBase ||
          sale.scale !== data.scale
        )
          throw new Error("Evento incompatible con el checkout");
        let status: SaleState | undefined;
        let exception: string | null = null;
        if (
          topic === "payment.late.v1" ||
          (topic === "payment.confirmed.v1" &&
            ["CANCELLED", "RELEASING"].includes(sale.status))
        ) {
          if (["AWAITING_PAYMENT", "RELEASING"].includes(sale.status))
            status = "RELEASING";
          else if (sale.status === "CANCELLED") status = "REVIEW";
          exception = "LATE_PAYMENT";
        } else if (sale.status === "AWAITING_PAYMENT") {
          status =
            topic === "payment.expired.v1" ? "RELEASING" : "PAYMENT_CONFIRMED";
          if (status === "RELEASING") exception = "PAYMENT_EXPIRED";
        }
        if (status)
          await tx.sale.update({
            where: { id: saleId },
            data: {
              status,
              exception,
              leaseToken: null,
              leaseUntil: null,
              retryAt: null,
            },
          });
        await tx.processedEvent.create({ data: { eventId } });
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
