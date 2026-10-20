export type PaymentStatus =
  "PENDING" | "DETECTED" | "CONFIRMING" | "CONFIRMED" | "REJECTED" | "EXPIRED";
export type PaymentFailureCode =
  | "TRANSACTION_NOT_FOUND"
  | "NETWORK_MISMATCH"
  | "INVALID_TOKEN"
  | "WRONG_RECIPIENT"
  | "AMOUNT_MISMATCH"
  | "TRANSACTION_FAILED"
  | "INSUFFICIENT_CONFIRMATIONS"
  | "ORDER_EXPIRED"
  | "DUPLICATE_TRANSACTION"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_TRANSACTION_DATA";
export interface PaymentOrder {
  id: string;
  saleId: string;
  merchantId: string;
  network: string;
  tokenSymbol: string;
  tokenContract: string;
  recipientAddress: string;
  amountBaseUnits: string;
  tokenDecimals: number;
  status: PaymentStatus;
  expiresAt: Date;
  transactionHash: string | null;
  failureCode: PaymentFailureCode | null;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
}
export interface Transfer {
  contractAddress: string;
  senderAddress: string;
  recipientAddress: string;
  amountBaseUnits: string;
}
export interface BlockchainTransaction {
  network: string;
  transactionHash: string;
  blockNumber: string;
  confirmed: boolean;
  success: boolean;
  confirmations: number;
  timestamp: number;
  transfers: Transfer[];
  rawPayload: Record<string, unknown>;
}
export interface PaymentAuditEvent {
  id: string;
  paymentOrderId: string;
  previousStatus: PaymentStatus | null;
  newStatus: PaymentStatus;
  eventType: string;
  failureCode: PaymentFailureCode | null;
  details: Record<string, unknown>;
  createdAt: Date;
}
