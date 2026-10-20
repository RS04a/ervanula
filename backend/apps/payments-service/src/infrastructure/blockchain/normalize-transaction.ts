import { BlockchainTransaction } from "../../domain/entities/models";
import { PaymentError } from "../../domain/errors/payment-error";
export function normalizeTransaction(
  value: BlockchainTransaction | null,
): BlockchainTransaction | null {
  if (value === null) return null;
  const text = (v: unknown): v is string =>
    typeof v === "string" && v.length > 0 && v.length <= 255;
  if (
    !value ||
    !text(value.transactionHash) ||
    !text(value.network) ||
    !/^\d{1,19}$/.test(value.blockNumber) ||
    BigInt(value.blockNumber) > 9223372036854775807n ||
    !Number.isSafeInteger(value.timestamp) ||
    !Number.isSafeInteger(value.confirmations) ||
    value.confirmations < 0 ||
    typeof value.confirmed !== "boolean" ||
    typeof value.success !== "boolean" ||
    !Array.isArray(value.transfers) ||
    value.transfers.length > 1000 ||
    value.transfers.some(
      (t) =>
        !t ||
        !text(t.contractAddress) ||
        !text(t.senderAddress) ||
        !text(t.recipientAddress) ||
        typeof t.amountBaseUnits !== "string" ||
        !/^\d{1,78}$/.test(t.amountBaseUnits),
    )
  )
    throw new PaymentError(
      "INVALID_TRANSACTION_DATA",
      "El proveedor devolvió datos inválidos",
    );
  return {
    ...value,
    blockNumber: BigInt(value.blockNumber).toString(),
    transfers: value.transfers.map((t) => ({
      ...t,
      amountBaseUnits: BigInt(t.amountBaseUnits).toString(),
    })),
  };
}
