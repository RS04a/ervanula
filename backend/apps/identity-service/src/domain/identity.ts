import { Actor, fault, field } from "../../../../libs/full-app/contract";

export interface User extends Actor {
  email: string;
  displayName: string;
  active: boolean;
}
export function email(value: unknown) {
  const normalized = field(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    fault(400, "INVALID_EMAIL", "Correo inválido");
  return normalized;
}
export function password(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    Buffer.byteLength(value) > 128
  )
    fault(
      400,
      "INVALID_PASSWORD",
      "La contraseña debe tener al menos 12 caracteres y hasta 128 bytes",
    );
  return value;
}
