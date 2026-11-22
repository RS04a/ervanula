import { createHash } from "node:crypto";
import {
  Actor,
  fault,
  field,
  object,
  requireAdmin,
} from "../../../../libs/full-app/contract";
import { headers, maxBytes, maxRows, ProductRow, row } from "../domain/rows";

interface RowResult {
  rowNumber: number;
  sku?: string;
  product?: ProductRow;
  error?: string;
  status: string;
}
interface Work {
  jobId: string;
  rowNumber: number;
  leaseToken: string;
  merchantId: string;
  userId: string;
  product: ProductRow;
  attempts: number;
}
export interface ImportRepository {
  create(
    actor: Actor,
    localId: string,
    digest: string,
    rows: RowResult[],
  ): Promise<unknown>;
  list(merchantId: string, offset: number, status?: string): Promise<unknown>;
  job(merchantId: string, id: string, offset: number): Promise<unknown>;
  confirm(merchantId: string, id: string): Promise<unknown>;
  retry(merchantId: string, id: string): Promise<unknown>;
  claim(): Promise<Work | null>;
  finish(
    work: Work,
    outcome: "APPLIED" | "FAILED" | "PENDING",
    error?: string,
    retryable?: boolean,
  ): Promise<void>;
}
export class Imports {
  constructor(
    readonly db: ImportRepository,
    private readonly parse: (bytes: Uint8Array) => string[][],
    private readonly apply: (work: Work) => Promise<void>,
  ) {}
  preview(actor: Actor, input: unknown) {
    requireAdmin(actor);
    const value = object(input);
    const id = field(value.id, "referencia");
    if (!/^[a-f0-9-]{36}$/.test(id))
      fault(400, "INVALID_ID", "Referencia inválida");
    const encoded = field(value.csv, "archivo CSV", (maxBytes * 4) / 3);
    if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4)
      fault(400, "INVALID_ENCODING", "Codificación de archivo inválida");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > maxBytes)
      fault(413, "CSV_LIMIT", "Archivo demasiado grande");
    let records: string[][];
    try {
      records = this.parse(bytes);
    } catch {
      return fault(
        400,
        "INVALID_CSV",
        "Archivo CSV inválido o codificación distinta de UTF-8",
      );
    }
    const [header, ...rows] = records;
    if (
      !header ||
      header.length !== headers.length ||
      header.some((column, index) => column !== headers[index])
    )
      fault(400, "INVALID_HEADERS", "Usa las cabeceras de la plantilla");
    if (!rows.length || rows.length > maxRows)
      fault(400, "CSV_LIMIT", "Carga entre 1 y 250 filas");
    const seen = new Map<string, number>();
    for (const values of rows) {
      const sku = values[0]?.trim().toUpperCase();
      if (sku) seen.set(sku, (seen.get(sku) ?? 0) + 1);
    }
    const results = rows.map((values, index): RowResult => {
      const rowNumber = index + 2;
      try {
        const product = row(values);
        if ((seen.get(product.sku) ?? 0) > 1)
          return {
            rowNumber,
            sku: product.sku,
            status: "INVALID",
            error: "SKU_DUPLICATE_IN_FILE",
          };
        return { rowNumber, sku: product.sku, status: "PENDING", product };
      } catch (error) {
        return {
          rowNumber,
          status: "INVALID",
          error: (error as { code?: string }).code ?? "INVALID_ROW",
        };
      }
    });
    return this.db.create(
      actor,
      id,
      createHash("sha256").update(bytes).digest("hex"),
      results,
    );
  }
  async step() {
    const work = await this.db.claim();
    if (!work) return;
    try {
      await this.apply(work);
    } catch (error) {
      const value = error as {
        code?: string;
        retryable?: boolean;
        httpStatus?: number;
      };
      const retry =
        value.retryable || !value.httpStatus || value.httpStatus >= 500;
      return this.db.finish(
        work,
        retry && work.attempts < 5 ? "PENDING" : "FAILED",
        value.code ?? "INVENTORY_UNAVAILABLE",
        retry,
      );
    }
    await this.db.finish(work, "APPLIED");
  }
}
