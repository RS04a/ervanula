export interface Snapshot {
  products: {
    id: string;
    sku: string;
    description: string;
    asset: string;
    priceBase: string;
    scale: number;
    minimum: number;
    active: boolean;
    createdAt: string;
    balance: { available: number; reserved: number } | null;
  }[];
  movements: { productId: string; createdAt: string }[];
  sales: {
    id: string;
    status: string;
    asset: string;
    totalBase: string;
    completedAt: string | null;
    items: { productId: string; quantity: number }[];
  }[];
  cash: {
    id: string;
    closedAt: string | null;
    differenceBase: string | null;
  }[];
  payments: {
    id: string;
    status: string;
    updatedAt: string;
    failureCode: string | null;
  }[];
}
const day = 86_400_000;
export function windowStart(at: string, days: number) {
  return new Date(Date.parse(at) - days * day).toISOString();
}
export function inWindow(value: string | null, start: string, end: string) {
  return value !== null && value >= start && value <= end;
}
export function diagnostics(snapshot: Snapshot, at: string, days: number) {
  const start = windowStart(at, days);
  const products = snapshot.products.filter((product) => product.active);
  const latest = new Map<string, string>();
  for (const movement of snapshot.movements) {
    if ((latest.get(movement.productId) ?? "") < movement.createdAt)
      latest.set(movement.productId, movement.createdAt);
  }
  const lowStock = products
    .filter((p) => (p.balance?.available ?? 0) < p.minimum)
    .map((p) => ({
      productId: p.id,
      sku: p.sku,
      available: p.balance?.available ?? 0,
      minimum: p.minimum,
    }));
  const dormant = products
    .filter((p) => p.createdAt <= start && (latest.get(p.id) ?? "") < start)
    .map((p) => ({
      productId: p.id,
      sku: p.sku,
      lastMovement: latest.get(p.id) ?? null,
    }));
  const sold = snapshot.sales.filter(
    (sale) =>
      sale.status === "COMPLETED" && inWindow(sale.completedAt, start, at),
  );
  const amounts = new Map<string, { count: number; amountBase: string }>();
  for (const sale of sold) {
    const current = amounts.get(sale.asset) ?? { count: 0, amountBase: "0" };
    amounts.set(sale.asset, {
      count: current.count + 1,
      amountBase: (
        BigInt(current.amountBase) + BigInt(sale.totalBase)
      ).toString(),
    });
  }
  const pendingSales = snapshot.sales
    .filter((sale) => !["COMPLETED", "CANCELLED"].includes(sale.status))
    .map(({ id, status, asset, totalBase }) => ({
      id,
      status,
      asset,
      totalBase,
    }));
  const cashDifferences = snapshot.cash.filter(
    (entry) =>
      inWindow(entry.closedAt, start, at) &&
      entry.differenceBase !== null &&
      entry.differenceBase !== "0",
  );
  const paymentFailures = snapshot.payments.filter(
    (p) =>
      inWindow(p.updatedAt, start, at) &&
      ["EXPIRED", "REJECTED"].includes(p.status),
  );
  return {
    start,
    end: at,
    days,
    lowStock,
    dormant,
    salesByAsset: Object.fromEntries(amounts),
    pendingSales,
    cashDifferences,
    paymentFailures,
    sufficient: {
      sales: sold.length > 0,
      products: products.length > 0,
      matureProducts: products.some((p) => p.createdAt <= start),
      payments: snapshot.payments.some((p) => inWindow(p.updatedAt, start, at)),
      cash: snapshot.cash.some((c) => inWindow(c.closedAt, start, at)),
    },
  };
}
