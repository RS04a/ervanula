import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { services, Service, fault } from "../../../libs/full-app/contract";
import { serviceRequest } from "../../../libs/full-app/service-http";

const cookie = "arveluna_session";
export const publicRoutes: ReadonlyArray<
  readonly [Service, "GET" | "POST", string]
> = [
  ["identity", "POST", "login"],
  ["identity", "POST", "logout"],
  ["identity", "GET", "session"],
  ["identity", "GET", "users"],
  ["identity", "POST", "users"],
  ["identity", "POST", "users/{id}/deactivate"],
  ["merchant", "GET", "profile"],
  ["merchant", "POST", "profile"],
  ["merchant", "POST", "wallets"],
  ["inventory", "GET", "products"],
  ["inventory", "POST", "products"],
  ["inventory", "POST", "products/{id}/edit"],
  ["inventory", "POST", "products/{id}/deactivate"],
  ["inventory", "GET", "movements"],
  ["inventory", "POST", "movements"],
  ["sales", "GET", "sales"],
  ["sales", "POST", "sales"],
  ["sales", "GET", "sales/{id}"],
  ["sales", "POST", "sales/{id}/items"],
  ["sales", "POST", "sales/{id}/checkout"],
  ["sales", "POST", "sales/{id}/cancel"],
  ["cash", "GET", "register"],
  ["cash", "GET", "sessions"],
  ["cash", "GET", "movements"],
  ["cash", "POST", "movements"],
  ["cash", "POST", "open"],
  ["cash", "POST", "close"],
  ["payments", "GET", "settings"],
  ["payments", "GET", "orders"],
  ["payments", "GET", "orders/{id}"],
  ["payments", "GET", "orders/{id}/audit"],
  ["payments", "POST", "orders/{id}/verify"],
  ["imports", "GET", "template"],
  ["imports", "GET", "jobs"],
  ["imports", "POST", "jobs"],
  ["imports", "GET", "jobs/{id}"],
  ["imports", "POST", "jobs/{id}/confirm"],
  ["imports", "POST", "jobs/{id}/retry"],
  ["analytics", "GET", "diagnostics"],
  ["analytics", "GET", "recommendations"],
  ["analytics", "POST", "reconcile"],
  ["analytics", "POST", "simulate"],
];
const routes = publicRoutes.map(([owner, method, path]) => ({
  owner,
  method,
  pattern: new RegExp(`^/${path.replace("{id}", "[a-zA-Z0-9_-]+")}$`),
}));
function readCookie(request: Request) {
  return request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookie}=`))
    ?.slice(cookie.length + 1);
}
@Controller("api")
export class FullAppGateway {
  @All("*path") async proxy(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const url = new URL(request.originalUrl, "http://localhost");
    const [, , owner, ...segments] = url.pathname.split("/");
    if (!Object.hasOwn(services, owner))
      fault(404, "NOT_FOUND", "Ruta inexistente");
    const service = owner as Service;
    const suffix = `/${segments.join("/")}`;
    if (
      !routes.some(
        (route) =>
          route.owner === service &&
          route.method === request.method &&
          route.pattern.test(suffix),
      )
    )
      fault(404, "NOT_FOUND", "Ruta inexistente");
    const write = request.method !== "GET";
    if (
      write &&
      (request.get("origin") !==
        (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173") ||
        request.get("x-arveluna-csrf") !== "1" ||
        !request.is("application/json"))
    )
      fault(403, "CSRF_REJECTED", "Origen o formato de petición inválido");
    const login = service === "identity" && suffix === "/login";
    const session = readCookie(request);
    if (!login && (!session || !/^[a-f0-9]{64}$/.test(session)))
      fault(401, "UNAUTHENTICATED", "Inicia sesión");
    const result = await serviceRequest(
      "gateway",
      service,
      `${service}${suffix}${url.search}`,
      {
        method: request.method,
        session,
        body: write ? request.body : undefined,
      },
    );
    const attributes = {
      httpOnly: true,
      sameSite: "strict" as const,
      path: "/api",
      secure: process.env.SESSION_SECURE === "true",
    };
    response.set("cache-control", "no-store");
    if (login && result.status < 300) {
      const { token } = result.data as { token: string };
      response.cookie(cookie, token, {
        ...attributes,
        maxAge: 8 * 60 * 60 * 1000,
      });
      response.status(result.status).json({ success: true });
      return;
    }
    if (service === "identity" && suffix === "/logout" && result.status < 300)
      response.clearCookie(cookie, attributes);
    response.status(result.status).json(result.data);
  }
}
