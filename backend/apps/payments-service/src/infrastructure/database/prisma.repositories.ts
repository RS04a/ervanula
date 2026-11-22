import { event } from "../../../../../libs/full-app/events";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  BlockchainTransaction,
  Transfer,
  PaymentOrder,
  PaymentStatus,
  PaymentAuditEvent,
} from "../../domain/entities/models";
import {
  PaymentOrderRepository,
  PaymentAuditRepository,
  BlockchainTransactionRepository,
} from "../../application/ports/ports";
import { PaymentError } from "../../domain/errors/payment-error";
const json = (value: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
const eventData = (event: PaymentAuditEvent) => ({
  ...event,
  details: json(event.details),
});
export class PrismaPaymentRepositories
  implements
    PaymentOrderRepository,
    PaymentAuditRepository,
    BlockchainTransactionRepository
{
  constructor(
    readonly client: PrismaClient,
    private readonly fullApp = false,
  ) {}
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
  async create(order: PaymentOrder, event: PaymentAuditEvent) {
    await this.client.$transaction([
      this.client.paymentOrder.create({ data: order }),
      this.client.paymentAuditEvent.create({ data: eventData(event) }),
    ]);
  }
  page(merchantId: string, skip: number, status?: PaymentStatus, take = 25) {
    return this.client.paymentOrder.findMany({
      where: { merchantId, status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  }
  due() {
    return this.client.paymentOrder.findFirst({
      where: {
        status: { in: ["PENDING", "DETECTED", "CONFIRMING"] },
        expiresAt: { lte: new Date() },
      },
      orderBy: { expiresAt: "asc" },
    });
  }
  get(id: string) {
    return this.client.paymentOrder.findUnique({ where: { id } });
  }
  findByHash(transactionHash: string) {
    return this.client.paymentOrder.findUnique({ where: { transactionHash } });
  }
  async list(paymentOrderId: string) {
    return (await this.client.paymentAuditEvent.findMany({
      where: { paymentOrderId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })) as PaymentAuditEvent[];
  }
  async append(event: PaymentAuditEvent) {
    await this.client.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM PaymentOrder WHERE id = ${event.paymentOrderId} FOR UPDATE`;
      const current = await db.paymentOrder.findUniqueOrThrow({
        where: { id: event.paymentOrderId },
      });
      await this.writeEvents(db, [
        { ...event, previousStatus: current.status, newStatus: current.status },
      ]);
    });
  }
  find(network: string, transactionHash: string) {
    return this.client.blockchainTransaction.findUnique({
      where: { network_transactionHash: { network, transactionHash } },
    });
  }
  private async writeEvents(
    db: Prisma.TransactionClient,
    events: PaymentAuditEvent[],
  ) {
    if (!events.length) return;
    const last = await db.paymentAuditEvent.findFirst({
      where: { paymentOrderId: events[0].paymentOrderId },
      orderBy: { createdAt: "desc" },
    });
    let timestamp = Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1);
    // Millisecond precision and row locking preserve transition order, even within one tick.
    await db.paymentAuditEvent.createMany({
      data: events.map((event) =>
        eventData({ ...event, createdAt: new Date(timestamp++) }),
      ),
    });
  }
  async commit(
    order: PaymentOrder,
    events: PaymentAuditEvent[],
    tx?: BlockchainTransaction,
    transfer?: Transfer,
  ) {
    try {
      await this.client.$transaction(async (db) => {
        const { id, version, ...data } = order;
        // Optimistic condition prevents concurrent verification overwriting terminal state.
        const result = await db.paymentOrder.updateMany({
          where: {
            id,
            version,
            status: events[0]?.previousStatus ?? order.status,
          },
          data: { ...data, version: { increment: 1 } },
        });
        if (result.count !== 1)
          throw new PaymentError(
            "INVALID_REQUEST",
            "Orden modificada concurrentemente",
            true,
            409,
          );
        if (tx && transfer) {
          const evidence = {
            ...transfer,
            network: tx.network,
            transactionHash: tx.transactionHash,
            blockNumber: BigInt(tx.blockNumber),
            confirmed: tx.confirmed,
            rawPayload: json({ ...tx, rawPayload: tx.rawPayload }),
          };
          await db.blockchainTransaction.upsert({
            where: {
              network_transactionHash: {
                network: tx.network,
                transactionHash: tx.transactionHash,
              },
            },
            create: evidence,
            update: evidence,
          });
        }
        await this.writeEvents(db, events);
        const late = events.some((entry) => entry.eventType === "LATE_PAYMENT");
        const topic = late
          ? "payment.late.v1"
          : order.status === "CONFIRMED"
            ? "payment.confirmed.v1"
            : order.status === "EXPIRED" &&
                events[0]?.previousStatus !== "EXPIRED"
              ? "payment.expired.v1"
              : null;
        if (this.fullApp && topic) {
          const message = event(topic, order.merchantId, order.saleId, {
            saleId: order.saleId,
            orderId: id,
            asset: order.tokenSymbol,
            network: order.network,
            contract: order.tokenContract,
            amountBase: order.amountBaseUnits,
            scale: order.tokenDecimals,
            transactionHash: order.transactionHash ?? "",
          });
          await db.outbox.create({
            data: { id: message.eventId, topic, payload: message },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new PaymentError(
          "DUPLICATE_TRANSACTION",
          "Transacción ya utilizada",
          false,
          409,
        );
      throw error;
    }
  }
}
