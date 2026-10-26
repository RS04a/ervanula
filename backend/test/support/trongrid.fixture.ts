import { normalizeTronAddress } from "../../apps/payments-service/src/domain/services/tron-address";
import {
  TRANSFER_TOPIC,
  TronGridHttp,
} from "../../apps/payments-service/src/infrastructure/blockchain/trongrid-payment.provider";
export const HASH = "ab".repeat(32);
export const CONTRACT_HEX = "a614f803b6fd780986a42c78ec9c7f77e6ded13c";
export const RECIPIENT_HEX = "81b64b1c09d448d25c9eeb3ee3b8f3348a694c96";
export const SENDER_HEX = "79309abcff2cf531070ca9222a1f72c4a5136874";
export const CONTRACT = normalizeTronAddress(CONTRACT_HEX);
export const RECIPIENT = normalizeTronAddress(RECIPIENT_HEX);
export const OPTIONS = {
  baseUrl: "https://api.trongrid.io",
  network: "mainnet",
  timeoutMs: 100,
};
export function tronFixture(timestamp = Date.now()) {
  const receipt = {
    id: HASH,
    blockNumber: 100,
    blockTimeStamp: timestamp,
    receipt: { result: "SUCCESS" },
    log: [
      {
        address: CONTRACT_HEX,
        topics: [
          TRANSFER_TOPIC,
          "0".repeat(24) + SENDER_HEX,
          "0".repeat(24) + RECIPIENT_HEX,
        ],
        data: 10000000n.toString(16).padStart(64, "0"),
      },
    ],
  };
  return {
    body: {
      txID: HASH,
      ret: [{ contractRet: "SUCCESS" }],
      raw_data: { contract: [{ type: "TriggerSmartContract" }] },
    },
    receipt,
    solid: structuredClone(receipt) as Record<string, unknown>,
    head: { block_header: { raw_data: { number: 110 } } },
  };
}
export type TronFixture = ReturnType<typeof tronFixture>;
export function fixtureHttp(fixture: TronFixture): {
  http: TronGridHttp;
  requests: { url: string; init: RequestInit | undefined }[];
} {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const http: TronGridHttp = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    const path = new URL(url).pathname;
    const routes: Record<string, unknown> = {
      "/wallet/gettransactionbyid": fixture.body,
      "/wallet/gettransactioninfobyid": fixture.receipt,
      "/wallet/getnowblock": fixture.head,
      "/walletsolidity/gettransactioninfobyid": fixture.solid,
    };
    if (!(path in routes)) throw new Error("Unexpected read route");
    return Response.json(routes[path]);
  };
  return { http, requests };
}
