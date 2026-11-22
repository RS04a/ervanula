import {
  ANALYTICS_PAGE_SIZE,
  Service,
  fault,
} from "../../../../libs/full-app/contract";
import { call } from "../../../../libs/full-app/service-http";
import type { Snapshot } from "../domain/diagnostics";

export async function readComplete<T>(
  page: (offset: number) => Promise<T[]>,
  size = 25,
) {
  const rows: T[] = [];
  for (let offset = 0; offset <= 5000; offset += size) {
    const next = await page(offset);
    rows.push(...next);
    if (rows.length > 5000) break;
    if (next.length < size) return rows;
  }
  return fault(
    409,
    "PROJECTION_LIMIT",
    "El comercio supera el límite del corte académico de 5.000 filas por origen",
  );
}
function read<T>(service: Service, path: string) {
  return readComplete<T>(
    (offset) => call("analytics", service, `${path}?offset=${offset}`),
    ANALYTICS_PAGE_SIZE,
  );
}
export async function collect(merchant: string): Promise<Snapshot> {
  const id = encodeURIComponent(merchant);
  const [products, movements, sales, cash, payments] = await Promise.all([
    read<Snapshot["products"][number]>(
      "inventory",
      `inventory/read/${id}/products`,
    ),
    read<Snapshot["movements"][number]>(
      "inventory",
      `inventory/read/${id}/movements`,
    ),
    read<Snapshot["sales"][number]>("sales", `sales/read/${id}`),
    read<Snapshot["cash"][number]>("cash", `cash/read/${id}`),
    read<Snapshot["payments"][number]>("payments", `payments/read/${id}`),
  ]);
  return { products, movements, sales, cash, payments };
}
