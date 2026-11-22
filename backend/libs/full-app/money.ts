import { fault } from "./contract";
export const scales = { COP: 2, USDT: 6, ARVE: 6 } as const;
export type Asset = keyof typeof scales;
export function asset(value: unknown): Asset {
  if (typeof value !== "string" || !Object.hasOwn(scales, value))
    fault(400, "INVALID_ASSET", "Elige COP, USDT o ARVE");
  return value as Asset;
}
export function baseUnits(value: unknown, currency: Asset): string {
  const scale = scales[currency];
  if (
    typeof value !== "string" ||
    !new RegExp(`^\\d{1,14}(?:\\.\\d{1,${scale}})?$`).test(value)
  )
    fault(400, "INVALID_AMOUNT", `Monto decimal inválido para ${currency}`);
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer + fraction.padEnd(scale, "0")).toString();
}
export function decimal(base: string, scale: number) {
  const number = BigInt(base);
  const value = (number < 0n ? -number : number)
    .toString()
    .padStart(scale + 1, "0");
  return `${number < 0n ? "-" : ""}${value.slice(0, -scale)}.${value.slice(-scale)}`;
}
export function integer(
  value: unknown,
  label: string,
  min = 0,
  max = 1_000_000,
) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    fault(400, "INVALID_QUANTITY", `Cantidad inválida para ${label}`);
  return value;
}
export function offset(value = "0") {
  if (!/^\d{1,6}$/.test(value))
    fault(400, "INVALID_OFFSET", "Paginación inválida");
  return Number(value);
}
