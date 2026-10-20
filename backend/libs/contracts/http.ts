import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
export const requestStorage = new AsyncLocalStorage<{ requestId: string }>();
import { randomUUID } from "node:crypto";
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header("x-request-id");
  const id =
    incoming && /^[a-zA-Z0-9_-]{1,80}$/.test(incoming)
      ? incoming
      : randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  requestStorage.run({ requestId: id }, () => {
    res.on("finish", () =>
      console.log(
        JSON.stringify({
          level: "info",
          operation: `${req.method} ${req.path}`,
          requestId: id,
          status: res.statusCode,
        }),
      ),
    );
    next();
  });
}
@Catch()
export class PublicErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const typed = error as {
      code?: string;
      message?: string;
      retryable?: boolean;
      httpStatus?: number;
    };
    const http =
      error instanceof HttpException
        ? error.getStatus()
        : (typed.httpStatus ?? 500);
    res.status(http).json({
      success: false,
      error: {
        code:
          (typed.httpStatus ? typed.code : undefined) ??
          (http === 400
            ? "INVALID_REQUEST"
            : http === 404
              ? "NOT_FOUND"
              : "INTERNAL_ERROR"),
        message:
          http >= 500 && !typed.retryable
            ? "Error interno controlado"
            : error instanceof HttpException
              ? "Petición inválida"
              : (typed.message ?? "Error interno"),
        retryable: typed.retryable ?? false,
      },
      requestId: res.locals.requestId,
    });
  }
}
