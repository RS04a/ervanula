import {
  PaymentOrder,
  PaymentAuditEvent,
} from "../../apps/payments-service/src/domain/entities/models";
import {
  PaymentOrderRepository,
  PaymentAuditRepository,
} from "../../apps/payments-service/src/application/ports/ports";
import { PaymentError } from "../../apps/payments-service/src/domain/errors/payment-error";
export class MemoryRepositories
  implements PaymentOrderRepository, PaymentAuditRepository
{
  orders = new Map<string, PaymentOrder>();
  events: PaymentAuditEvent[] = [];
  async create(order: PaymentOrder, event: PaymentAuditEvent) {
    this.orders.set(order.id, structuredClone(order));
    this.events.push(event);
  }
  async get(id: string) {
    return structuredClone(this.orders.get(id) ?? null);
  }
  async findByHash(hash: string) {
    return structuredClone(
      [...this.orders.values()].find((o) => o.transactionHash === hash) ?? null,
    );
  }
  async commit(order: PaymentOrder, events: PaymentAuditEvent[]) {
    if (order.transactionHash) {
      const owner = await this.findByHash(order.transactionHash);
      if (owner && owner.id !== order.id)
        throw new PaymentError("DUPLICATE_TRANSACTION", "Duplicada");
    }
    this.orders.set(order.id, structuredClone(order));
    this.events.push(...events);
  }
  async list(id: string) {
    return this.events.filter((e) => e.paymentOrderId === id);
  }
  async append(event: PaymentAuditEvent) {
    this.events.push(event);
  }
}
