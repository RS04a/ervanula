import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { requestStorage } from "../contracts/http";
import { Actor, fault, Service, services } from "./contract";

export function serviceKey(service: Service): string {
  const value = process.env[`SERVICE_KEY_${service.toUpperCase()}`];
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new Error(`Falta credencial del servicio ${service}`);
  return value;
}
const digest = (value: string) => createHash("sha256").update(value).digest();
export function authenticateService(
  req: Request,
  allowed: readonly Service[] | readonly ["gateway", ...Service[]],
) {
  const caller = req.header("x-arveluna-service") ?? "";
  const key = req.header("x-arveluna-key") ?? "";
  if (
    !(allowed as readonly string[]).includes(caller) ||
    !timingSafeEqual(
      digest(key),
      digest(
        caller === "gateway" ? gatewayKey() : serviceKey(caller as Service),
      ),
    )
  ) {
    fault(401, "SERVICE_UNAUTHORIZED", "Credencial interna inválida");
  }
  return caller as Service | "gateway";
}
export function gatewayKey() {
  const key = process.env.SERVICE_KEY_GATEWAY;
  if (!key || !/^[a-f0-9]{64}$/.test(key))
    throw new Error("Falta credencial del Gateway");
  return key;
}
export function port(service: Service) {
  return Number(
    process.env[`${service.toUpperCase()}_PORT`] ?? services[service],
  );
}
export async function serviceRequest(
  caller: Service | "gateway",
  target: Service,
  path: string,
  options: { method?: string; body?: unknown; session?: string } = {},
) {
  const requestId = requestStorage.getStore()?.requestId ?? "";
  let response: globalThis.Response;
  try {
    response = await fetch(
      `http://127.0.0.1:${port(target)}/internal/${path}`,
      {
        method: options.method ?? "GET",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
          "x-arveluna-service": caller,
          "x-arveluna-key":
            caller === "gateway" ? gatewayKey() : serviceKey(caller),
          "x-arveluna-session": options.session ?? "",
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: "error",
        signal: AbortSignal.timeout(target === "payments" ? 20000 : 6000),
      },
    );
    return {
      status: response.status,
      data: (await response.json()) as unknown,
    };
  } catch {
    fault(
      503,
      "COMMUNICATION_ERROR",
      `Servicio ${target} temporalmente no disponible`,
      true,
    );
  }
}
export async function call<T>(
  ...args: Parameters<typeof serviceRequest>
): Promise<T> {
  const response = await serviceRequest(...args);
  if (response.status >= 400) {
    const body = response.data as {
      error?: { code: string; message: string; retryable?: boolean };
    };
    fault(
      response.status,
      body.error?.code ?? "SERVICE_ERROR",
      body.error?.message ?? "Error de servicio",
      body.error?.retryable,
    );
  }
  return response.data as T;
}
export function sessionToken(req: Request) {
  const token = req.header("x-arveluna-session") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token))
    fault(401, "UNAUTHENTICATED", "Inicia sesión");
  return token;
}
export async function actorFor(req: Request, service: Service) {
  authenticateService(req, ["gateway"]);
  return call<Actor>(service, "identity", "identity/session", {
    session: sessionToken(req),
  });
}
