import { asset, baseUnits, integer } from "../../../../libs/full-app/money";
import { field, fault } from "../../../../libs/full-app/contract";

export interface ProductRow {
  sku: string;
  description: string;
  asset: string;
  price: string;
  minimum: number;
  quantity: number;
}
export const headers = [
  "sku",
  "description",
  "asset",
  "price",
  "minimum",
  "opening_quantity",
];
export const maxRows = 250;
export const maxBytes = 60_000;

export function row(values: string[]): ProductRow {
  if (values.length !== headers.length)
    fault(400, "INVALID_COLUMN_COUNT", "Cantidad de columnas inválida");
  const [rawSku, rawDescription, rawAsset, rawPrice, min, qty] = values;
  const sku = field(rawSku, "SKU", 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku))
    fault(400, "INVALID_SKU", "SKU inválido");
  const currency = asset(rawAsset.trim());
  const price = rawPrice.trim();
  if (baseUnits(price, currency) === "0")
    fault(400, "INVALID_PRICE", "Precio debe ser positivo");
  if (!/^\d{1,7}$/.test(min.trim()) || !/^\d{1,7}$/.test(qty.trim()))
    fault(
      400,
      "INVALID_QUANTITY",
      "Usa cantidades enteras de cero o más unidades",
    );
  return {
    sku,
    description: field(rawDescription, "descripción"),
    asset: currency,
    price,
    minimum: integer(Number(min), "mínimo"),
    quantity: integer(Number(qty), "cantidad inicial"),
  };
}
