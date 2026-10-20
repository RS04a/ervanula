import { BlockchainProvider, Logger } from "../../application/ports/ports";
import { PaymentError } from "../../domain/errors/payment-error";
import { normalizeTransaction } from "./normalize-transaction";
export class BlockchainProviderProxy implements BlockchainProvider {
  constructor(
    private readonly provider: BlockchainProvider,
    private readonly timeout: number,
    private readonly retries: number,
    private readonly logger: Logger,
  ) {}
  async getTransaction(hash: string) {
    for (let attempt = 0; ; attempt++) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return normalizeTransaction(
          await Promise.race([
            this.provider.getTransaction(hash),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Provider timeout")),
                this.timeout,
              );
            }),
          ]),
        );
      } catch (error) {
        if (error instanceof PaymentError && !error.retryable) throw error;
        this.logger.log("warn", "provider.request", "provider", { attempt });
        if (attempt >= this.retries)
          throw new PaymentError(
            "PROVIDER_UNAVAILABLE",
            "Proveedor temporalmente no disponible",
            true,
            503,
          );
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
