import {
  BlockchainTransaction,
  PaymentOrder,
  PaymentAuditEvent,
  Transfer,
} from "../../domain/entities/models";
export interface PaymentOrderRepository {
  create(order: PaymentOrder, event: PaymentAuditEvent): Promise<void>;
  get(id: string): Promise<PaymentOrder | null>;
  findByHash(hash: string): Promise<PaymentOrder | null>;
  commit(
    order: PaymentOrder,
    events: PaymentAuditEvent[],
    transaction?: BlockchainTransaction,
    transfer?: Transfer,
  ): Promise<void>;
}
export interface BlockchainTransactionRepository {
  find(network: string, hash: string): Promise<unknown>;
}
export interface PaymentAuditRepository {
  list(id: string): Promise<PaymentAuditEvent[]>;
  append(event: PaymentAuditEvent): Promise<void>;
}
export interface BlockchainProvider {
  getTransaction(hash: string): Promise<BlockchainTransaction | null>;
}
export interface PaymentVerificationStrategy {
  verify(
    order: PaymentOrder,
    transaction: BlockchainTransaction,
  ): { transfer: Transfer; confirmed: boolean };
}
export interface Logger {
  log(
    level: string,
    operation: string,
    requestId: string,
    context: Record<string, unknown>,
  ): void;
}
export interface PaymentConfig {
  network: string;
  contract: string;
  expirationMinutes: number;
  minConfirmations: number;
}
