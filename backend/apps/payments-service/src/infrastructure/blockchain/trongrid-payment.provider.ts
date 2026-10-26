import { BlockchainProvider } from "../../application/ports/ports";
import { BlockchainTransaction, Transfer } from "../../domain/entities/models";
import { PaymentError } from "../../domain/errors/payment-error";
import {
  normalizeTronAddress,
  tronAddressFromTopic,
} from "../../domain/services/tron-address";
import { validateTronGridEndpoint } from "./trongrid-network";
// keccak256(Transfer(address,address,uint256)); protocol constant, never a contract address.
export const TRANSFER_TOPIC =
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export interface TronGridOptions {
  baseUrl: string;
  network: string;
  apiKey?: string;
  timeoutMs: number;
}
export type TronGridHttp = typeof fetch;
type JsonObject = Record<string, unknown>;
const invalid = (): never => {
  throw new PaymentError(
    "INVALID_TRANSACTION_DATA",
    "Respuesta blockchain inválida o incompleta",
  );
};
const unavailable = (retryable = true): never => {
  throw new PaymentError(
    "PROVIDER_UNAVAILABLE",
    "Proveedor blockchain no disponible",
    retryable,
    503,
  );
};
const object = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as JsonObject;
};
const integer = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    return invalid();
  return value;
};
const hash = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-fA-F0-9]{64}$/.test(value))
    return invalid();
  return value.toLowerCase();
};
interface Receipt {
  id: string;
  blockNumber: number;
  timestamp: number;
  success: boolean;
  transfers: Transfer[];
}
function parseReceipt(data: JsonObject): Receipt {
  const execution = object(data.receipt);
  if (typeof execution.result !== "string" || !execution.result.length)
    return invalid();
  const success = execution.result === "SUCCESS";
  if (data.log !== undefined && !Array.isArray(data.log)) return invalid();
  const logs = (data.log ?? []) as unknown[];
  if (logs.length > 1000) return invalid();
  const transfers: Transfer[] = [];
  for (const item of logs) {
    const log = object(item);
    if (!Array.isArray(log.topics)) return invalid();
    if (!log.topics.length) continue;
    if (typeof log.topics[0] !== "string") return invalid();
    if (log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
    // ERC-721 shares the signature but indexes tokenId (4 topics, no value data).
    if (
      log.topics.length === 4 &&
      (log.data === "" || log.data === "0x") &&
      log.topics.every(
        (topic) => typeof topic === "string" && /^[a-fA-F0-9]{64}$/.test(topic),
      )
    )
      continue;
    if (
      log.topics.length !== 3 ||
      typeof log.data !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(log.data) ||
      typeof log.address !== "string"
    )
      return invalid();
    transfers.push({
      contractAddress: normalizeTronAddress(log.address),
      senderAddress: tronAddressFromTopic(log.topics[1] as string),
      recipientAddress: tronAddressFromTopic(log.topics[2] as string),
      amountBaseUnits: BigInt("0x" + log.data).toString(),
    });
  }
  return {
    id: hash(data.id),
    blockNumber: integer(data.blockNumber),
    timestamp: integer(data.blockTimeStamp),
    success,
    transfers,
  };
}
/** Only read endpoints. No key management, signatures, contract calls or broadcasts. */
export class TronGridPaymentProvider implements BlockchainProvider {
  private readonly baseUrl: string;
  constructor(
    private readonly options: TronGridOptions,
    private readonly http: TronGridHttp = fetch,
  ) {
    this.baseUrl = validateTronGridEndpoint(options.baseUrl, options.network);
  }
  async getTransaction(
    transactionHash: string,
    signal?: AbortSignal,
  ): Promise<BlockchainTransaction | null> {
    const id = hash(transactionHash);
    const body = await this.read(
      "/wallet/gettransactionbyid",
      { value: id },
      signal,
    );
    if (!Object.keys(body).length) return null;
    if (hash(body.txID) !== id) return invalid();
    const raw = object(body.raw_data);
    if (!Array.isArray(raw.contract) || !raw.contract.length) return invalid();
    const contracts = raw.contract.map(object);
    const info = await this.read(
      "/wallet/gettransactioninfobyid",
      { value: id },
      signal,
    );
    if (!Object.keys(info).length) return unavailable(); // body can precede receipt due to indexing lag
    if (!Array.isArray(body.ret) || !body.ret.length) return invalid();
    const results = body.ret.map(object);
    if (
      results.some(
        (ret) => typeof ret.contractRet !== "string" || !ret.contractRet,
      )
    )
      return invalid();
    const receipt = parseReceipt(info);
    if (receipt.id !== id) return invalid();
    const head = await this.read("/wallet/getnowblock", {}, signal);
    const height = integer(object(object(head.block_header).raw_data).number);
    if (height < receipt.blockNumber) return unavailable();
    const solid = await this.read(
      "/walletsolidity/gettransactioninfobyid",
      { value: id },
      signal,
    );
    let confirmed = false;
    if (Object.keys(solid).length) {
      const solidReceipt = parseReceipt(solid);
      if (JSON.stringify(solidReceipt) !== JSON.stringify(receipt))
        return unavailable();
      confirmed = true;
    }
    const smartContract = contracts.some(
      (contract) => contract.type === "TriggerSmartContract",
    );
    return {
      network: this.options.network,
      transactionHash: id,
      blockNumber: String(receipt.blockNumber),
      timestamp: receipt.timestamp,
      confirmed,
      confirmations: height - receipt.blockNumber + 1,
      success:
        receipt.success &&
        results.every((ret) => ret.contractRet === "SUCCESS"),
      transfers: smartContract ? receipt.transfers : [],
      rawPayload: {
        provider: "trongrid",
        network: this.options.network,
        transaction: body,
        receipt: info,
        solidifiedReceipt: solid,
        headBlockNumber: height,
      },
    };
  }
  private async read(
    path: string,
    body: JsonObject,
    signal?: AbortSignal,
  ): Promise<JsonObject> {
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await this.http(this.baseUrl + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey
            ? { "TRON-PRO-API-KEY": this.options.apiKey }
            : {}),
        },
        body: JSON.stringify(body),
        signal: combined,
        redirect: "manual",
      });
      if (!response.ok)
        return unavailable(
          [408, 425, 429].includes(response.status) || response.status >= 500,
        );
      // Bound parsing to avoid retaining unbounded upstream payloads.
      const reader = response.body?.getReader();
      if (!reader) return invalid();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 2_000_000) return invalid();
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      let value: unknown;
      try {
        value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return invalid();
      }
      const result = object(value);
      if ("Error" in result || "error" in result) return unavailable(false);
      return result;
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      return unavailable();
    }
  }
}
