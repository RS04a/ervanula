import { randomUUID } from "node:crypto";
import {
  PaymentOrder,
  PaymentAuditEvent,
  PaymentStatus,
  BlockchainTransaction,
} from "../../domain/entities/models";
import { PaymentError } from "../../domain/errors/payment-error";
import { toBaseUnits, transition } from "../../domain/services/payment-rules";
import {
  PaymentOrderRepository,
  PaymentAuditRepository,
  BlockchainProvider,
  PaymentVerificationStrategy,
  PaymentConfig,
} from "../ports/ports";
export function audit(
  order: PaymentOrder,
  previousStatus: PaymentStatus | null,
  eventType: string,
  requestId: string,
): PaymentAuditEvent {
  return {
    id: randomUUID(),
    paymentOrderId: order.id,
    previousStatus,
    newStatus: order.status,
    eventType,
    failureCode: order.failureCode,
    details: { requestId },
    createdAt: new Date(),
  };
}
export class CreatePaymentOrder {
  constructor(
    private readonly repository: PaymentOrderRepository,
    private readonly config: PaymentConfig,
  ) {}
  async execute(
    input: {
      saleId: string;
      merchantId: string;
      recipientAddress: string;
      amount: string;
    },
    requestId: string,
  ) {
    const now = new Date();
    const order: PaymentOrder = {
      id: randomUUID(),
      saleId: input.saleId,
      merchantId: input.merchantId,
      recipientAddress: input.recipientAddress,
      network: this.config.network,
      tokenSymbol: "USDT",
      tokenContract: this.config.contract,
      amountBaseUnits: toBaseUnits(input.amount),
      tokenDecimals: 6,
      status: "PENDING",
      expiresAt: new Date(
        now.getTime() + this.config.expirationMinutes * 60000,
      ),
      transactionHash: null,
      failureCode: null,
      createdAt: now,
      updatedAt: now,
      confirmedAt: null,
    };
    await this.repository.create(
      order,
      audit(order, null, "ORDER_CREATED", requestId),
    );
    return order;
  }
}
export class GetPaymentOrder {
  constructor(private readonly repository: PaymentOrderRepository) {}
  async execute(id: string) {
    const order = await this.repository.get(id);
    if (!order)
      throw new PaymentError("NOT_FOUND", "Orden no encontrada", false, 404);
    return order;
  }
}
export class GetPaymentAudit {
  constructor(
    private readonly get: GetPaymentOrder,
    private readonly repository: PaymentAuditRepository,
  ) {}
  async execute(id: string) {
    await this.get.execute(id);
    return this.repository.list(id);
  }
}
export class VerifyPayment {
  constructor(
    private readonly repository: PaymentOrderRepository,
    private readonly audits: PaymentAuditRepository,
    private readonly provider: BlockchainProvider,
    private readonly strategy: PaymentVerificationStrategy,
  ) {}
  async execute(id: string, hash: string, requestId: string) {
    const order = await new GetPaymentOrder(this.repository).execute(id);
    if (order.status === "CONFIRMED" && order.transactionHash === hash)
      return order;
    if (["CONFIRMED", "REJECTED", "EXPIRED"].includes(order.status))
      throw new PaymentError(
        "INVALID_REQUEST",
        "Orden en estado terminal",
        false,
        409,
      );
    const previous = order.status;
    let evidence: BlockchainTransaction | null = null;
    if (order.expiresAt.getTime() < Date.now()) {
      transition(order, "EXPIRED");
      order.failureCode = "ORDER_EXPIRED";
      await this.repository.commit(order, [
        audit(order, previous, "ORDER_EXPIRED", requestId),
      ]);
      throw new PaymentError("ORDER_EXPIRED", "La orden venció");
    }
    try {
      const owner = await this.repository.findByHash(hash);
      if (owner && owner.id !== id)
        throw new PaymentError(
          "DUPLICATE_TRANSACTION",
          "La transacción ya pertenece a otra orden",
          false,
          409,
        );
      if (order.transactionHash && order.transactionHash !== hash)
        throw new PaymentError(
          "INVALID_REQUEST",
          "La orden ya tiene una transacción asignada",
          false,
          409,
        );
      const tx = await this.provider.getTransaction(hash);
      evidence = tx;
      if (!tx)
        throw new PaymentError(
          "TRANSACTION_NOT_FOUND",
          "Transacción no encontrada",
          true,
          404,
        );
      if (tx.transactionHash !== hash)
        throw new PaymentError(
          "INVALID_TRANSACTION_DATA",
          "Hash del proveedor no coincide",
        );
      const result = this.strategy.verify(order, tx);
      const events: PaymentAuditEvent[] = [];
      order.transactionHash = hash;
      order.failureCode = null;
      if (order.status === "PENDING") {
        transition(order, "DETECTED");
        events.push(audit(order, previous, "TRANSACTION_DETECTED", requestId));
      }
      const before = order.status;
      transition(order, result.confirmed ? "CONFIRMED" : "CONFIRMING");
      order.failureCode = result.confirmed
        ? null
        : "INSUFFICIENT_CONFIRMATIONS";
      events.push(audit(order, before, "PAYMENT_VERIFIED", requestId));
      await this.repository.commit(order, events, tx, result.transfer);
      return order;
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      if (
        error.retryable ||
        error.code === "DUPLICATE_TRANSACTION" ||
        error.code === "INVALID_REQUEST"
      ) {
        const event = audit(
          {
            ...order,
            status: previous,
            failureCode:
              error.code === "INVALID_REQUEST"
                ? null
                : (error.code as PaymentOrder["failureCode"]),
          },
          previous,
          "VERIFICATION_FAILED",
          requestId,
        );
        await this.audits.append(event);
      } else {
        order.status = previous;
        transition(
          order,
          error.code === "ORDER_EXPIRED" ? "EXPIRED" : "REJECTED",
        );
        order.failureCode = error.code as PaymentOrder["failureCode"];
        await this.repository.commit(
          order,
          [audit(order, previous, "VERIFICATION_REJECTED", requestId)],
          evidence ?? undefined,
          evidence?.transfers[0],
        );
      }
      throw error;
    }
  }
}
