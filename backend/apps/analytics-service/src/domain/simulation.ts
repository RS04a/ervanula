import { fault, field, object } from "../../../../libs/full-app/contract";
import { integer } from "../../../../libs/full-app/money";
import { inWindow, Snapshot, windowStart } from "./diagnostics";

export function simulate(snapshot: Snapshot, at: string, value: unknown) {
  const body = object(value);
  const productId = field(body.productId, "producto");
  const baselineDays = integer(body.baselineDays, "periodo base", 1, 365);
  const horizonDays = integer(body.horizonDays, "horizonte", 1, 365);
  const priceBasisPoints = integer(
    body.priceBasisPoints,
    "variación de precio",
    -10000,
    100000,
  );
  const demandBasisPoints = integer(
    body.demandBasisPoints,
    "variación de demanda",
    -10000,
    100000,
  );
  const product = snapshot.products.find((p) => p.id === productId);
  if (!product) fault(404, "NOT_FOUND", "Producto fuera del corte analítico");
  const start = windowStart(at, baselineDays);
  const rows = snapshot.sales
    .filter(
      (s) => s.status === "COMPLETED" && inWindow(s.completedAt, start, at),
    )
    .flatMap((sale) =>
      sale.items
        .filter((item) => item.productId === productId)
        .map((item) => ({ saleId: sale.id, quantity: item.quantity })),
    );
  const sold = rows.reduce((sum, row) => sum + BigInt(row.quantity), 0n);
  const available = BigInt(product.balance?.available ?? 0);
  const qty =
    (sold * BigInt(horizonDays) * BigInt(10000 + demandBasisPoints)) /
    (BigInt(baselineDays) * 10000n);
  const price =
    (BigInt(product.priceBase) * BigInt(10000 + priceBasisPoints)) / 10000n;
  const needed = qty + BigInt(product.minimum) - available;
  return {
    scenario: true,
    sku: product.sku,
    asset: product.asset,
    scale: product.scale,
    start,
    end: at,
    assumptions: {
      baselineDays,
      horizonDays,
      priceBasisPoints,
      demandBasisPoints,
    },
    baseline: {
      units: sold.toString(),
      priceBase: product.priceBase,
      available: available.toString(),
      minimum: product.minimum,
      sales: rows.length,
    },
    sufficient: rows.length > 0,
    projectedPriceBase: price.toString(),
    projectedUnits: rows.length ? qty.toString() : null,
    projectedRevenueBase: rows.length ? (qty * price).toString() : null,
    reorderUnits: rows.length ? (needed > 0n ? needed : 0n).toString() : null,
    calculation:
      "Unidades = ventas base × horizonte / días base × factor de demanda. Reposición = máximo(0, unidades + mínimo − disponible). Se redondea hacia abajo.",
  };
}
