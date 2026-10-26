import { loadEnvironment } from "../../../../../libs/contracts/environment";
import { normalizeTronAddress } from "../../domain/services/tron-address";
import {
  TRONGRID_ORIGINS,
  validateTronGridEndpoint,
} from "../blockchain/trongrid-network";
loadEnvironment();
export class AppConfig {
  readonly network = process.env.TRON_NETWORK ?? "mainnet";
  readonly contract =
    process.env.TRC20_TOKEN_CONTRACT || process.env.USDT_CONTRACT_ADDRESS || "";
  readonly expirationMinutes = this.integer("PAYMENT_EXPIRATION_MINUTES", 30);
  readonly minConfirmations = this.integer(
    process.env.TRON_MIN_CONFIRMATIONS
      ? "TRON_MIN_CONFIRMATIONS"
      : "MIN_CONFIRMATIONS",
    1,
  );
  readonly timeout = this.integer("PROVIDER_TIMEOUT_MS", 5000);
  readonly retries = this.integer("PROVIDER_MAX_RETRIES", 2, true);
  readonly databaseUrl = process.env.DATABASE_URL;
  readonly provider =
    process.env.PAYMENT_PROVIDER ||
    process.env.BLOCKCHAIN_PROVIDER ||
    "simulated";
  readonly tronGridBaseUrl =
    process.env.TRONGRID_BASE_URL || TRONGRID_ORIGINS[this.network];
  readonly tronGridApiKey = process.env.TRONGRID_API_KEY || undefined;
  constructor() {
    if (this.retries > 3)
      throw new Error("PROVIDER_MAX_RETRIES no puede superar 3");
    if (this.timeout > 30000)
      throw new Error("PROVIDER_TIMEOUT_MS no puede superar 30000");
    if (!["mainnet", "shasta", "nile"].includes(this.network))
      throw new Error("TRON_NETWORK inválida");
    if (!this.databaseUrl?.startsWith("mysql://"))
      throw new Error("DATABASE_URL debe ser mysql://");
    if (!["simulated", "trongrid"].includes(this.provider))
      throw new Error("PAYMENT_PROVIDER/BLOCKCHAIN_PROVIDER inválido");
    try {
      this.contract = normalizeTronAddress(this.contract);
    } catch {
      throw new Error("USDT_CONTRACT_ADDRESS/TRC20_TOKEN_CONTRACT inválido");
    }
    if (this.provider === "trongrid")
      validateTronGridEndpoint(this.tronGridBaseUrl, this.network);
    if (this.tronGridApiKey && /[\r\n]/.test(this.tronGridApiKey))
      throw new Error("TRONGRID_API_KEY inválida");
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
