export const services = {
  identity: 3011,
  merchant: 3012,
  inventory: 3013,
  sales: 3014,
  cash: 3015,
  payments: 3001,
  imports: 3017,
  analytics: 3018,
} as const;
export type Service = keyof typeof services;
export type Role = "ADMIN" | "CASHIER";
export interface Actor {
  userId: string;
  merchantId: string;
  role: Role;
}
export function fault(
  httpStatus: number,
  code: string,
  message: string,
  retryable = false,
): never {
  throw Object.assign(new Error(message), { httpStatus, code, retryable });
}
export function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") fault(403, "FORBIDDEN", "Se requiere rol ADMIN");
}
export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fault(400, "INVALID_REQUEST", "Se esperaba un objeto");
  return value as Record<string, unknown>;
}
export function field(value: unknown, label: string, limit = 120): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    fault(400, "INVALID_FIELD", `Valor inválido para ${label}`);
  return value.trim();
}

export function optionalChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
): T | undefined {
  if (value === undefined || value === "") return undefined;
  const match = choices.find((choice) => choice === value);
  if (!match) fault(400, "INVALID_FILTER", "Filtro inválido");
  return match;
}

export const ANALYTICS_PAGE_SIZE = 250;
