import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@arveluna/analytics-db";
import type { Event } from "../../../../libs/full-app/events";
import type { ReadModels } from "../application/analytics";
import type { Snapshot } from "../domain/diagnostics";

type Claim = NonNullable<Awaited<ReturnType<ReadModels["claim"]>>>;
export class PrismaReadModels implements ReadModels {
  constructor(readonly db = new PrismaClient()) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  async request(merchantId: string) {
    await this.db
      .$executeRaw`INSERT INTO Projection (merchantId, revision, collectedRevision)
      VALUES (${merchantId}, 1, -1) ON DUPLICATE KEY UPDATE revision = revision + 1, retryAt = NULL`;
  }
  async get(merchantId: string) {
    const row = await this.db.projection.findUnique({ where: { merchantId } });
    if (!row?.collectedAt || !row.payload) return null;
    return {
      collectedAt: row.collectedAt,
      payload: row.payload as unknown as Snapshot,
      stale:
        row.revision !== row.collectedRevision ||
        Date.now() - +row.collectedAt > 60_000,
    };
  }
  async claim(merchantId?: string) {
    const [row] = await this.db.$queryRaw<
      { merchantId: string; revision: number; leaseToken: string | null }[]
    >`
      SELECT merchantId, revision, leaseToken FROM Projection
      WHERE (revision > collectedRevision OR collectedAt < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 60 SECOND)) AND (${merchantId ?? null} IS NULL OR merchantId = ${merchantId ?? null})
        AND (leaseUntil IS NULL OR leaseUntil < CURRENT_TIMESTAMP(3))
        AND (retryAt IS NULL OR retryAt < CURRENT_TIMESTAMP(3)) ORDER BY collectedAt LIMIT 1`;
    if (!row) return null;
    const leaseToken = randomUUID();
    const written = await this.db.projection.updateMany({
      where: { merchantId: row.merchantId, leaseToken: row.leaseToken },
      data: { leaseToken, leaseUntil: new Date(Date.now() + 120_000) },
    });
    return written.count
      ? { merchantId: row.merchantId, revision: row.revision, leaseToken }
      : null;
  }
  async save(claim: Claim, payload: Snapshot, collectedAt: Date) {
    await this.db.projection.updateMany({
      where: { merchantId: claim.merchantId, leaseToken: claim.leaseToken },
      data: {
        payload: payload as unknown as Prisma.InputJsonValue,
        collectedAt,
        collectedRevision: claim.revision,
        leaseToken: null,
        leaseUntil: null,
        retryAt: null,
      },
    });
  }
  async fail(claim: Claim) {
    await this.db.projection.updateMany({
      where: { merchantId: claim.merchantId, leaseToken: claim.leaseToken },
      data: {
        leaseToken: null,
        leaseUntil: null,
        retryAt: new Date(Date.now() + 5000),
      },
    });
  }
  async event(message: Event) {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { eventId: message.eventId } });
        await tx.$executeRaw`INSERT INTO Projection (merchantId, revision, collectedRevision)
          VALUES (${message.merchantId}, 1, -1) ON DUPLICATE KEY UPDATE revision = revision + 1`;
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
    }
  }
}
