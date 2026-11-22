import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@arveluna/imports-db";
import { Actor, fault } from "../../../../libs/full-app/contract";
import { ImportRepository } from "../application/imports";
import type { ProductRow } from "../domain/rows";

type Work = NonNullable<Awaited<ReturnType<ImportRepository["claim"]>>>;
export class PrismaImports implements ImportRepository {
  constructor(readonly db = new PrismaClient()) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  async create(
    actor: Actor,
    localId: string,
    digest: string,
    rows: Parameters<ImportRepository["create"]>[3],
  ) {
    const id = `${actor.merchantId}-${localId}`;
    try {
      const job = await this.db.importJob.create({
        data: {
          id,
          merchantId: actor.merchantId,
          userId: actor.userId,
          contentDigest: digest,
          status: "PREVIEW",
          rows: {
            create: rows.map((row) => ({
              ...row,
              product: row.product as Prisma.InputJsonValue | undefined,
            })),
          },
        },
      });
      return job;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      const existing = await this.db.importJob.findUniqueOrThrow({
        where: { id },
      });
      if (existing.contentDigest !== digest)
        fault(409, "REFERENCE_CONFLICT", "Referencia usada para otro CSV");
      return existing;
    }
  }
  list(merchantId: string, skip: number, status?: string) {
    return this.db.importJob.findMany({
      where: { merchantId, status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: 25,
    });
  }
  async job(merchantId: string, id: string, skip: number) {
    const job = await this.db.importJob.findFirst({
      where: { merchantId, id },
      include: {
        rows: { orderBy: { rowNumber: "asc" }, skip, take: 25 },
        _count: { select: { rows: true } },
      },
    });
    if (!job) fault(404, "NOT_FOUND", "Importación inexistente");
    const status = await this.db.importRowResult.groupBy({
      by: ["status"],
      where: { jobId: id },
      _count: true,
    });
    return {
      ...job,
      progress: Object.fromEntries(
        status.map((entry) => [entry.status, entry._count]),
      ),
    };
  }
  async confirm(merchantId: string, id: string) {
    await this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM ImportJob WHERE id = ${id} AND merchantId = ${merchantId} FOR UPDATE`;
        if (!rows.length) fault(404, "NOT_FOUND", "Importación inexistente");
        const job = await tx.importJob.findUniqueOrThrow({ where: { id } });
        if (job.status === "PREVIEW") {
          const valid = await tx.importRowResult.count({
            where: { jobId: id, status: "PENDING" },
          });
          await tx.importJob.update({
            where: { id },
            data: {
              status: valid ? "RUNNING" : "DONE",
              confirmedAt: new Date(),
            },
          });
        }
      },
      { isolationLevel: "ReadCommitted" },
    );
    return this.job(merchantId, id, 0);
  }
  async retry(merchantId: string, id: string) {
    await this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM ImportJob WHERE id = ${id} AND merchantId = ${merchantId} FOR UPDATE`;
        if (!rows.length) fault(404, "NOT_FOUND", "Importación inexistente");
        const count = await tx.importRowResult.updateMany({
          where: { jobId: id, status: "FAILED", retryable: true },
          data: { status: "PENDING", attempts: 0, retryAt: null, error: null },
        });
        if (count.count)
          await tx.importJob.update({
            where: { id },
            data: { status: "RUNNING" },
          });
      },
      { isolationLevel: "ReadCommitted" },
    );
    return this.job(merchantId, id, 0);
  }
  async claim(): Promise<Work | null> {
    const now = new Date();
    const row = await this.db.importRowResult.findFirst({
      where: {
        status: "PENDING",
        job: { status: "RUNNING" },
        AND: [
          { OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
          { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
        ],
      },
      include: { job: true },
      orderBy: [{ retryAt: "asc" }, { rowNumber: "asc" }],
    });
    if (!row?.product) return null;
    const leaseToken = randomUUID();
    const updated = await this.db.importRowResult.updateMany({
      where: {
        jobId: row.jobId,
        rowNumber: row.rowNumber,
        leaseToken: row.leaseToken,
        status: "PENDING",
      },
      data: {
        leaseToken,
        leaseUntil: new Date(+now + 30_000),
        attempts: { increment: 1 },
      },
    });
    return updated.count
      ? {
          jobId: row.jobId,
          rowNumber: row.rowNumber,
          leaseToken,
          product: row.product as unknown as ProductRow,
          merchantId: row.job.merchantId,
          userId: row.job.userId,
          attempts: row.attempts + 1,
        }
      : null;
  }
  async finish(
    work: Work,
    status: "APPLIED" | "FAILED" | "PENDING",
    error?: string,
    retryable = false,
  ) {
    await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM ImportJob WHERE id = ${work.jobId} FOR UPDATE`;
        await tx.importRowResult.updateMany({
          where: {
            jobId: work.jobId,
            rowNumber: work.rowNumber,
            leaseToken: work.leaseToken,
          },
          data: {
            status,
            retryable,
            error: error ?? null,
            leaseUntil: null,
            leaseToken: null,
            retryAt:
              status === "PENDING"
                ? new Date(Date.now() + work.attempts * 1500)
                : null,
          },
        });
        if (
          status !== "PENDING" &&
          !(await tx.importRowResult.count({
            where: { jobId: work.jobId, status: "PENDING" },
          }))
        )
          await tx.importJob.update({
            where: { id: work.jobId },
            data: { status: "DONE" },
          });
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
}
