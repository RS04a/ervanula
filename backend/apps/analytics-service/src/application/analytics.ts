import type { Event } from "../../../../libs/full-app/events";
import { fault } from "../../../../libs/full-app/contract";
import { diagnostics, Snapshot } from "../domain/diagnostics";
import { recommendations } from "../domain/recommendation";
import { simulate } from "../domain/simulation";

interface Claim {
  merchantId: string;
  leaseToken: string;
  revision: number;
}
export interface ReadModels {
  request(merchantId: string): Promise<void>;
  get(
    merchantId: string,
  ): Promise<{ collectedAt: Date; payload: Snapshot; stale: boolean } | null>;
  claim(merchantId?: string): Promise<Claim | null>;
  save(claim: Claim, payload: Snapshot, time: Date): Promise<void>;
  fail(claim: Claim): Promise<void>;
  event(message: Event): Promise<void>;
}
export class Analytics {
  constructor(
    readonly models: ReadModels,
    private readonly collect: (merchant: string) => Promise<Snapshot>,
  ) {}
  async rebuild(merchantId: string) {
    await this.models.request(merchantId);
    await this.reconcile(merchantId);
    return {
      lastUpdated: (await this.models.get(merchantId))?.collectedAt ?? null,
    };
  }
  async reconcile(merchantId?: string) {
    const claim = await this.models.claim(merchantId);
    if (!claim) return;
    try {
      await this.models.save(
        claim,
        await this.collect(claim.merchantId),
        new Date(),
      );
    } catch (error) {
      await this.models.fail(claim);
      throw error;
    }
  }
  private async view(merchantId: string) {
    let current = await this.models.get(merchantId);
    if (!current) {
      await this.rebuild(merchantId);
      current = await this.models.get(merchantId);
    }
    if (!current)
      fault(
        503,
        "PROJECTION_PENDING",
        "Proyección pendiente de actualización",
        true,
      );
    return current;
  }
  async report(
    merchantId: string,
    days: number,
    mode: "diagnostics" | "recommendations",
  ) {
    const data = await this.view(merchantId);
    const report = diagnostics(
      data.payload,
      data.collectedAt.toISOString(),
      days,
    );
    return {
      lastUpdated: data.collectedAt,
      stale: data.stale,
      ...(mode === "diagnostics" ? report : recommendations(report)),
    };
  }
  async simulate(merchantId: string, assumptions: unknown) {
    const data = await this.view(merchantId);
    return {
      lastUpdated: data.collectedAt,
      stale: data.stale,
      ...simulate(data.payload, data.collectedAt.toISOString(), assumptions),
    };
  }
}
