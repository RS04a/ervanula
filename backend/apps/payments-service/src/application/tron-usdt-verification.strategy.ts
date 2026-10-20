import { PaymentVerificationStrategy } from "./ports/ports";
import { BlockchainTransaction, PaymentOrder } from "../domain/entities/models";
import { PaymentError } from "../domain/errors/payment-error";
export class TronUsdtVerificationStrategy implements PaymentVerificationStrategy {
  constructor(private readonly minConfirmations: number) {}
  verify(order: PaymentOrder, tx: BlockchainTransaction) {
    const fail = (
      code: ConstructorParameters<typeof PaymentError>[0],
      message: string,
    ): never => {
      throw new PaymentError(code, message);
    };
    if (tx.network !== order.network)
      fail("NETWORK_MISMATCH", "Red incorrecta");
    if (!tx.success) fail("TRANSACTION_FAILED", "La transacción falló");
    if (
      !/^\d+$/.test(tx.blockNumber) ||
      !Number.isSafeInteger(tx.timestamp) ||
      !Number.isInteger(tx.confirmations) ||
      tx.confirmations < 0 ||
      tx.transfers.some((t) => !/^\d+$/.test(t.amountBaseUnits))
    )
      fail("INVALID_TRANSACTION_DATA", "Datos de transacción inválidos");
    if (
      tx.timestamp > order.expiresAt.getTime() ||
      tx.timestamp > Date.now() + 1000 ||
      tx.timestamp < order.createdAt.getTime()
    )
      fail("ORDER_EXPIRED", "Transferencia fuera de la vigencia");
    const tokens = tx.transfers.filter(
      (t) => t.contractAddress === order.tokenContract,
    );
    if (!tokens.length) fail("INVALID_TOKEN", "Contrato de token incorrecto");
    const recipients = tokens.filter(
      (t) => t.recipientAddress === order.recipientAddress,
    );
    if (!recipients.length)
      fail(
        "WRONG_RECIPIENT",
        "La transferencia tiene un destinatario diferente",
      );
    const transfer = recipients.find(
      (t) => BigInt(t.amountBaseUnits) === BigInt(order.amountBaseUnits),
    );
    if (!transfer) return fail("AMOUNT_MISMATCH", "Monto incorrecto");
    return {
      transfer,
      confirmed: tx.confirmed && tx.confirmations >= this.minConfirmations,
    };
  }
}
