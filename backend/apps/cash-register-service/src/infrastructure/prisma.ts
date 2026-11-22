import { Prisma, PrismaClient } from "@arveluna/cash-db";
import { Actor, fault } from "../../../../libs/full-app/contract";
import type { CashRepository, CashEntry } from "../application/cash";
import { expected } from "../domain/cash";

type Tx = Prisma.TransactionClient;
async function lock(tx: Tx, merchantId: string) {
  await tx.$executeRaw`INSERT INTO CashRegister (merchantId, name) VALUES (${merchantId}, 'Caja principal') ON DUPLICATE KEY UPDATE name = name`;
  return tx.cashRegister.findUniqueOrThrow({ where: { merchantId } });
}
function conflict(): never {
  return fault(
    409,
    "REFERENCE_CONFLICT",
    "Referencia usada para otra operación",
  );
}
export class PrismaCash implements CashRepository {
  constructor(readonly db = new PrismaClient()) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  async register(merchantId: string) {
    const register = await this.db.cashRegister.findUnique({
      where: { merchantId },
    });
    const session = register?.activeId
      ? await this.db.cashSession.findUnique({
          where: { id: register.activeId },
        })
      : null;
    return { name: register?.name ?? "Caja principal", session };
  }
  sessions(merchantId: string, skip: number, take = 25) {
    return this.db.cashSession.findMany({
      where: { merchantId },
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }
  movements(merchantId: string, skip: number, asset?: string) {
    return this.db.cashMovement.findMany({
      where: { merchantId, asset },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: 25,
    });
  }
  open(actor: Actor, openReference: string, openingBase: string) {
    const { merchantId, userId } = actor;
    return this.db.$transaction(async (tx) => {
      const register = await lock(tx, merchantId);
      const existing = await tx.cashSession.findUnique({
        where: { merchantId_openReference: { merchantId, openReference } },
      });
      if (existing) {
        if (existing.openingBase !== openingBase || existing.userId !== userId)
          conflict();
        return existing;
      }
      if (register.activeId)
        fault(409, "CASH_OPEN", "La caja ya tiene una sesión abierta");
      const session = await tx.cashSession.create({
        data: {
          merchantId,
          userId,
          openReference,
          openingBase,
          expectedBase: openingBase,
        },
      });
      await tx.cashRegister.update({
        where: { merchantId },
        data: { activeId: session.id },
      });
      return session;
    });
  }
  close(actor: Actor, id: string, closeReference: string, countedBase: string) {
    const { merchantId, userId } = actor;
    return this.db.$transaction(async (tx) => {
      const register = await lock(tx, merchantId);
      const existing = await tx.cashSession.findUnique({
        where: { merchantId_closeReference: { merchantId, closeReference } },
      });
      if (existing) {
        if (
          existing.id !== id ||
          existing.countedBase !== countedBase ||
          existing.closedBy !== userId
        )
          conflict();
        return existing;
      }
      if (register.activeId !== id)
        fault(409, "CASH_CLOSED", "La sesión de caja ya no está abierta");
      const session = await tx.cashSession.findUniqueOrThrow({ where: { id } });
      const closed = await tx.cashSession.update({
        where: { id },
        data: {
          countedBase,
          closeReference,
          closedBy: userId,
          closedAt: new Date(),
          differenceBase: (
            BigInt(countedBase) - BigInt(session.expectedBase)
          ).toString(),
        },
      });
      await tx.cashRegister.update({
        where: { merchantId },
        data: { activeId: null },
      });
      return closed;
    });
  }
  record(entry: CashEntry, sessionId?: string) {
    const { merchantId, reference, kind, amountBase } = entry;
    return this.db.$transaction(async (tx) => {
      const register = await lock(tx, merchantId);
      const existing = await tx.cashMovement.findUnique({
        where: { merchantId_reference: { merchantId, reference } },
      });
      if (existing) {
        if (
          existing.kind !== kind ||
          existing.amountBase !== amountBase ||
          existing.asset !== entry.asset ||
          existing.paymentId !== (entry.paymentId ?? null) ||
          existing.userId !== entry.userId ||
          existing.reason !== entry.reason ||
          (sessionId && existing.sessionId !== sessionId)
        )
          conflict();
        return existing;
      }
      if (kind === "DIGITAL_SALE")
        return tx.cashMovement.create({ data: entry });
      if (!register.activeId || (sessionId && register.activeId !== sessionId))
        fault(
          409,
          "CASH_CLOSED",
          "Abre una sesión de caja para registrar efectivo",
        );
      const session = await tx.cashSession.findUniqueOrThrow({
        where: { id: register.activeId },
      });
      const expectedBase = expected(session.expectedBase, amountBase, kind);
      const movement = await tx.cashMovement.create({
        data: { ...entry, sessionId: session.id },
      });
      await tx.cashSession.update({
        where: { id: session.id },
        data: { expectedBase },
      });
      return movement;
    });
  }
}
