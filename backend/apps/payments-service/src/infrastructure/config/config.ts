import { loadEnvironment } from "../../../../../libs/contracts/environment";
loadEnvironment();
export class AppConfig {
  readonly network = process.env.TRON_NETWORK ?? "mainnet";
  readonly contract =
    process.env.USDT_CONTRACT_ADDRESS ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  readonly expirationMinutes = this.integer("PAYMENT_EXPIRATION_MINUTES", 30);
  readonly minConfirmations = this.integer("MIN_CONFIRMATIONS", 1);
  readonly timeout = this.integer("PROVIDER_TIMEOUT_MS", 5000);
  readonly retries = this.integer("PROVIDER_MAX_RETRIES", 2, true);
  readonly databaseUrl = process.env.DATABASE_URL;
  readonly provider = process.env.BLOCKCHAIN_PROVIDER ?? "simulated";
  constructor() {
    if (this.retries > 3)
      throw new Error("PROVIDER_MAX_RETRIES no puede superar 3");
    if (this.timeout > 30000)
      throw new Error("PROVIDER_TIMEOUT_MS no puede superar 30000");
    if (!["mainnet", "shasta", "nile"].includes(this.network))
      throw new Error("TRON_NETWORK inválida");
    if (!this.databaseUrl?.startsWith("mysql://"))
      throw new Error("DATABASE_URL debe ser mysql://");
    if (this.provider !== "simulated")
      throw new Error(
        "Esta entrega admite BLOCKCHAIN_PROVIDER=simulated; TronGrid es opcional y no está implementado",
      );
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(this.contract))
      throw new Error("Contrato TRON inválido");
    if (process.env.USDT_DECIMALS && process.env.USDT_DECIMALS !== "6")
      throw new Error("USDT_DECIMALS debe ser 6");
  }
  private integer(key: string, fallback: number, zero = false) {
    const value = Number(process.env[key] ?? fallback);
    if (
      !Number.isSafeInteger(value) ||
      value < (zero ? 0 : 1) ||
      value > 1000000
    )
      throw new Error(`Configuración inválida: ${key}`);
    return value;
  }
}
