import { DEMO_HASH } from "../domain/services/transaction-hash";
import { createHash } from "node:crypto";
import { fault } from "../../../../libs/full-app/contract";
import { PaymentOrder, PaymentStatus } from "../domain/entities/models";
import { transition } from "../domain/services/payment-rules";
import {
  BlockchainProvider,
  PaymentOrderRepository,
  PaymentVerificationStrategy,
} from "./ports/ports";
import { audit, CreatePaymentOrder, VerifyPayment } from "./use-cases/payments";

export interface PaymentReadStore extends PaymentOrderRepository {
  page(
    merchantId: string,
    skip: number,
    status?: PaymentStatus,
    take?: number,
  ): Promise<PaymentOrder[]>;
  due(): Promise<PaymentOrder | null>;
}
export interface WalletDirectory {
  receiver(merchantId: string, network: string, asset: string): Promise<string>;
}
export interface AssetProfile {
  network: string;
  contract: string;
  simulated: boolean;
  provider: BlockchainProvider;
  verify: VerifyPayment;
  strategy: PaymentVerificationStrategy;
}
export class SalePayments {
  constructor(
    readonly db: PaymentReadStore,
    private readonly create: CreatePaymentOrder,
    private readonly wallets: WalletDirectory,
    private readonly profiles: { USDT: AssetProfile; ARVE?: AssetProfile },
  ) {}
  async order(merchantId: string, id: string) {
    const order = await this.db.get(id);
    if (!order || order.merchantId !== merchantId)
      fault(404, "NOT_FOUND", "Orden inexistente");
    return order;
  }
  async checkout(
    input: {
      merchantId: string;
      saleId: string;
      asset: string;
      amount: string;
    },
    requestId: string,
  ) {
    const { merchantId, saleId, asset, amount } = input;
    const id = createHash("sha256")
      .update(JSON.stringify([merchantId, saleId]))
      .digest("hex");
    const matching = async () => {
      const existing = await this.db.get(id);
      if (
        existing &&
        (existing.merchantId !== merchantId ||
          existing.saleId !== saleId ||
          existing.tokenSymbol !== asset ||
          BigInt(existing.amountBaseUnits) !== BigInt(amount.replace(".", "")))
      )
        fault(
          409,
          "REFERENCE_CONFLICT",
          "El checkout corresponde a otra orden",
        );
      return existing;
    };
    const existing = await matching();
    if (existing) return existing;
    const profile =
      asset === "USDT"
        ? this.profiles.USDT
        : asset === "ARVE"
          ? this.profiles.ARVE
          : undefined;
    if (!profile)
      fault(409, "PROFILE_MISSING", "El activo carece de contrato configurado");
    const recipientAddress = await this.wallets.receiver(
      merchantId,
      profile.network,
      asset,
    );
    if (recipientAddress === profile.contract)
      fault(
        409,
        "WALLET_CONTRACT_COLLISION",
        "La billetera receptora debe ser distinta del contrato",
      );
    try {
      return await this.create.execute(
        {
          merchantId,
          saleId,
          id,
          amount,
          recipientAddress,
          tokenSymbol: asset,
          tokenContract: profile.contract,
          network: profile.network,
        },
        requestId,
      );
    } catch (error) {
      const committed = await matching();
      if (committed) return committed;
      throw error;
    }
  }
  async expire() {
    const order = await this.db.due();
    if (!order) return;
    const previous = order.status;
    transition(order, "EXPIRED");
    order.failureCode = "ORDER_EXPIRED";
    await this.db.commit(order, [
      audit(order, previous, "ORDER_EXPIRED", order.saleId),
    ]);
  }
  async check(
    merchantId: string,
    id: string,
    inputHash: string,
    requestId: string,
  ): Promise<PaymentOrder> {
    const hash = /^[a-fA-F0-9]{64}$/.test(inputHash)
      ? inputHash.toLowerCase()
      : inputHash;
    const order = await this.order(merchantId, id);
    const profile =
      order.tokenSymbol === "ARVE" ? this.profiles.ARVE : this.profiles.USDT;
    if (!profile || order.network !== profile.network)
      fault(409, "PROFILE_MISSING", "El perfil de la orden requiere revisión");
    if (
      !/^[a-f0-9]{64}$/.test(hash) &&
      !(profile.simulated && DEMO_HASH.test(hash))
    )
      fault(400, "INVALID_HASH", "Hash de transacción inválido");
    if (order.status !== "EXPIRED" && order.status !== "REJECTED") {
      if (
        order.status === "CONFIRMED" ||
        order.expiresAt.getTime() > Date.now()
      )
        return profile.verify.execute(id, hash, requestId);
      const previous = order.status;
      transition(order, "EXPIRED");
      order.failureCode = "ORDER_EXPIRED";
      await this.db.commit(order, [
        audit(order, previous, "ORDER_EXPIRED", requestId),
      ]);
      return this.check(merchantId, id, hash, requestId);
    }
    if (order.transactionHash === hash && order.confirmedAt) return order;
    if (order.transactionHash && order.transactionHash !== hash)
      fault(409, "HASH_ASSIGNED", "La orden conserva otra referencia");
    const owner = await this.db.findByHash(hash);
    if (owner && owner.id !== id)
      fault(409, "DUPLICATE_TRANSACTION", "Hash ya utilizado");
    const evidence = await profile.provider.getTransaction(hash);
    if (!evidence || evidence.transactionHash !== hash)
      fault(404, "TRANSACTION_NOT_FOUND", "Transferencia no encontrada", true);
    const result = profile.strategy.verify(
      { ...order, expiresAt: new Date() },
      evidence,
    );
    if (!result.confirmed)
      fault(409, "INSUFFICIENT_CONFIRMATIONS", "Espera confirmaciones", true);
    order.transactionHash = hash;
    order.confirmedAt = new Date();
    await this.db.commit(
      order,
      [audit(order, order.status, "LATE_PAYMENT", requestId)],
      evidence,
      result.transfer,
    );
    return order;
  }
}
