import { Prisma, PrismaClient } from "@arveluna/inventory-db";
import { Actor, fault } from "../../../../libs/full-app/contract";
import { event } from "../../../../libs/full-app/events";
import {
  InventoryRepository,
  ProductInput,
  Movement,
  StockItem,
} from "../application/inventory";
import { change } from "../domain/stock";

type Tx = Prisma.TransactionClient;
const missing = () => fault(404, "NOT_FOUND", "Producto inexistente");
async function transaction<T>(
  db: PrismaClient,
  operation: (tx: Tx) => Promise<T>,
) {
  for (let count = 0; ; count++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: "ReadCommitted",
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (error.code === "P2002")
        fault(409, "DUPLICATE_REFERENCE", "SKU o referencia duplicados");
      if (error.code !== "P2034" || count >= 2) throw error;
    }
  }
}
async function lock(tx: Tx, merchantId: string, id: string) {
  const locked = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM Product WHERE id = ${id} AND merchantId = ${merchantId} FOR UPDATE`;
  if (!locked.length) missing();
  return tx.product.findUniqueOrThrow({
    where: { id },
    include: { balance: true },
  });
}
async function balance(
  tx: Tx,
  actor: Actor,
  reference: string,
  productId: string,
  value: { available: number; reserved: number },
) {
  await tx.stockBalance.update({ where: { productId }, data: value });
  const message = event(
    "inventory.stock-changed.v1",
    actor.merchantId,
    reference,
    { productId, ...value },
  );
  await tx.outbox.create({
    data: { id: message.eventId, topic: message.topic, payload: message },
  });
}

export class PrismaInventory implements InventoryRepository {
  constructor(readonly db = new PrismaClient()) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  list(merchantId: string, skip: number, search: string, take = 25) {
    return this.db.product.findMany({
      where: {
        merchantId,
        OR: [
          { sku: { contains: search.toUpperCase() } },
          { description: { contains: search } },
        ],
      },
      include: { balance: true },
      orderBy: { id: "asc" },
      skip,
      take,
    });
  }
  movements(merchantId: string, skip: number, productId?: string, take = 25) {
    return this.db.stockMovement.findMany({
      where: { merchantId, productId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }
  async product(merchantId: string, id: string) {
    const product = await this.db.product.findFirst({
      where: { merchantId, id },
    });
    return product as (ProductInput & { id: string; active: boolean }) | null;
  }
  create(merchantId: string, product: ProductInput) {
    return transaction(this.db, (tx) =>
      tx.product.create({
        data: { merchantId, ...product, balance: { create: {} } },
        include: { balance: true },
      }),
    );
  }
  edit(merchantId: string, id: string, product: ProductInput | null) {
    return transaction(this.db, async (tx) => {
      await lock(tx, merchantId, id);
      return tx.product.update({
        where: { id },
        data: product ?? { active: false },
        include: { balance: true },
      });
    });
  }
  move(actor: Actor, movement: Movement) {
    const { productId, reference, quantity, reason, kind } = movement;
    return transaction(this.db, async (tx) => {
      const product = await lock(tx, actor.merchantId, productId);
      const existing = await tx.stockMovement.findUnique({
        where: {
          merchantId_reference: { merchantId: actor.merchantId, reference },
        },
      });
      if (existing) {
        if (
          existing.productId !== productId ||
          existing.quantity !== quantity ||
          existing.kind !== kind ||
          existing.reason !== reason
        )
          fault(
            409,
            "REFERENCE_CONFLICT",
            "Referencia usada para otra operación",
          );
        return existing;
      }
      if (!product.active || !product.balance)
        fault(409, "INACTIVE_PRODUCT", "Producto inactivo");
      const result = await tx.stockMovement.create({
        data: {
          ...movement,
          merchantId: actor.merchantId,
          userId: actor.userId,
        },
      });
      await balance(
        tx,
        actor,
        reference,
        productId,
        change(product.balance, quantity),
      );
      return result;
    });
  }
  reserve(merchantId: string, saleId: string, items: StockItem[]) {
    return transaction(this.db, async (tx) => {
      const actor: Actor = { merchantId, userId: "sales", role: "CASHIER" };
      const products = [];
      for (const item of [...items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      ))
        products.push({
          item,
          product: await lock(tx, merchantId, item.productId),
        });
      const existing = await tx.stockReservation.findMany({
        where: { merchantId, saleId },
      });
      if (existing.length) {
        if (
          existing.length !== items.length ||
          !existing.every((row) =>
            items.some(
              (item) =>
                item.productId === row.productId &&
                item.quantity === row.quantity,
            ),
          )
        )
          fault(
            409,
            "REFERENCE_CONFLICT",
            "La reserva ya tiene otros artículos",
          );
        if (existing.some((row) => row.status === "RELEASED"))
          fault(409, "RESERVATION_RELEASED", "Reserva liberada");
        return { success: true };
      }
      for (const { item, product } of products) {
        if (!product.active || !product.balance)
          fault(409, "INACTIVE_PRODUCT", "Producto inactivo");
        await tx.stockReservation.create({
          data: { merchantId, saleId, ...item, status: "RESERVED" },
        });
        await balance(
          tx,
          actor,
          saleId,
          product.id,
          change(product.balance, item.quantity, "reserve"),
        );
      }
      return { success: true };
    });
  }
  settle(actor: Actor, saleId: string, action: "consume" | "release") {
    const target = action === "consume" ? "CONSUMED" : "RELEASED";
    return transaction(this.db, async (tx) => {
      const candidates = await tx.stockReservation.findMany({
        where: { merchantId: actor.merchantId, saleId },
        orderBy: { productId: "asc" },
      });
      if (!candidates.length && action === "consume")
        fault(409, "RESERVATION_MISSING", "Reserva inexistente");
      for (const candidate of candidates) {
        const product = await lock(tx, actor.merchantId, candidate.productId);
        const row = await tx.stockReservation.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (row.status === target) continue;
        if (row.status !== "RESERVED" || !product.balance)
          fault(409, "RESERVATION_CONFLICT", "Reserva en estado incompatible");
        await tx.stockReservation.update({
          where: { id: row.id },
          data: { status: target },
        });
        await balance(
          tx,
          actor,
          saleId,
          product.id,
          change(product.balance, row.quantity, action),
        );
        if (action === "consume")
          await tx.stockMovement.create({
            data: {
              merchantId: actor.merchantId,
              userId: actor.userId,
              productId: product.id,
              reference: `sale:${saleId}:${product.id}`,
              kind: "SALE",
              quantity: -row.quantity,
              reason: "Venta cobrada",
            },
          });
      }
      return { success: true };
    });
  }
  async applyImport(
    actor: Actor,
    reference: string,
    product: ProductInput,
    quantity: number,
  ) {
    const receiptKey = { merchantId: actor.merchantId, reference };
    const lookup = () =>
      this.db.importReceipt.findUnique({
        where: { merchantId_reference: receiptKey },
      });
    const existing = await lookup();
    if (existing) return existing;
    try {
      return await transaction(this.db, async (tx) => {
        const created = await tx.product.create({
          data: {
            ...product,
            merchantId: actor.merchantId,
            balance: { create: {} },
          },
        });
        if (quantity) {
          await tx.stockMovement.create({
            data: {
              ...receiptKey,
              userId: actor.userId,
              productId: created.id,
              quantity,
              kind: "IN",
              reason: "Carga CSV",
            },
          });
          await balance(tx, actor, reference, created.id, {
            available: quantity,
            reserved: 0,
          });
        }
        return tx.importReceipt.create({
          data: { ...receiptKey, productId: created.id },
        });
      });
    } catch (error) {
      const committed = await lookup();
      if (committed) return committed;
      throw error;
    }
  }
}
