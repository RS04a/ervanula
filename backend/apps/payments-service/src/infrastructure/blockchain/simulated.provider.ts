import { BlockchainProvider } from "../../application/ports/ports";
import { BlockchainTransaction } from "../../domain/entities/models";
export const DEMO_ADDRESS = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
export class SimulatedBlockchainProvider implements BlockchainProvider {
  constructor(
    private readonly contract: string,
    private readonly network: string,
  ) {}
  async getTransaction(hash: string): Promise<BlockchainTransaction | null> {
    const scenario = hash.split(":")[1];
    if (scenario === "missing" || !hash.startsWith("demo:")) return null;
    if (scenario === "unavailable")
      throw new Error("Simulated temporary outage");
    if (scenario === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 200));
      throw new Error("Simulated timeout");
    }
    const transfer = {
      contractAddress: scenario === "token" ? "invalid" : this.contract,
      senderAddress: DEMO_ADDRESS,
      recipientAddress: scenario === "recipient" ? "TWrong" : DEMO_ADDRESS,
      amountBaseUnits: scenario === "amount" ? "999" : "10000000",
    };
    return {
      network: scenario === "network" ? "shasta" : this.network,
      transactionHash: hash,
      blockNumber: "123456",
      confirmed: scenario !== "pending",
      success: scenario !== "failed",
      confirmations: scenario === "pending" ? 0 : 20,
      timestamp: Date.now(),
      transfers:
        scenario === "multi"
          ? [{ ...transfer, amountBaseUnits: "1" }, transfer]
          : [transfer],
      rawPayload: { simulated: true, scenario },
    };
  }
}
