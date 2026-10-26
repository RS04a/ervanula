import { BlockchainProvider } from "../../application/ports/ports";
import { AppConfig } from "../config/config";
import { SimulatedBlockchainProvider } from "./simulated.provider";
import {
  TronGridPaymentProvider,
  TronGridHttp,
} from "./trongrid-payment.provider";
export function selectBlockchainProvider(
  config: AppConfig,
  http: TronGridHttp = fetch,
): BlockchainProvider {
  if (config.provider === "trongrid")
    return new TronGridPaymentProvider(
      {
        baseUrl: config.tronGridBaseUrl,
        network: config.network,
        apiKey: config.tronGridApiKey,
        timeoutMs: config.timeout,
      },
      http,
    );
  return new SimulatedBlockchainProvider(config.contract, config.network);
}
