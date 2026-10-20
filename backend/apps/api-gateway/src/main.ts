import "reflect-metadata";
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Inject,
  Module,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder, ApiBody } from "@nestjs/swagger";
import { Response } from "express";
import { loadEnvironment } from "../../../libs/contracts/environment";
import {
  PublicErrorFilter,
  requestContext,
} from "../../../libs/contracts/http";
loadEnvironment();
export class PaymentsHttpClient {
  readonly url = process.env.PAYMENTS_SERVICE_URL ?? "http://localhost:3001";
  constructor() {
    const url = new URL(this.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("PAYMENTS_SERVICE_URL inválida");
  }
  async request(path: string, requestId: string, body?: unknown) {
    try {
      const response = await fetch(`${this.url}/internal/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const data: unknown = await response.json();
      return { status: response.status, data };
    } catch {
      throw Object.assign(
        new Error("Payments Service temporalmente no disponible"),
        { code: "COMMUNICATION_ERROR", retryable: true, httpStatus: 503 },
      );
    }
  }
}
@Controller("api")
class GatewayController {
  constructor(
    @Inject(PaymentsHttpClient) private readonly client: PaymentsHttpClient,
  ) {}
  private async forward(path: string, res: Response, body?: unknown) {
    const result = await this.client.request(path, res.locals.requestId, body);
    res.status(result.status).json(result.data);
  }
  @Get("health") health(@Res() res: Response) {
    return this.forward("health", res);
  }
  @Post("payments/orders")
  @ApiBody({
    schema: {
      type: "object",
      required: ["saleId", "merchantId", "recipientAddress", "amount"],
      properties: {
        saleId: { type: "string", example: "SALE-001" },
        merchantId: { type: "string", example: "MERCHANT-001" },
        recipientAddress: {
          type: "string",
          example: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
        },
        amount: { type: "string", example: "10.00" },
      },
    },
  })
  create(@Body() body: unknown, @Res() res: Response) {
    return this.forward("payments/orders", res, body);
  }
  @Get("payments/orders/:id") get(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    return this.forward(`payments/orders/${encodeURIComponent(id)}`, res);
  }
  @Post("payments/orders/:id/verify")
  @ApiBody({
    schema: {
      type: "object",
      required: ["transactionHash"],
      properties: {
        transactionHash: { type: "string", example: "demo:valid:001" },
      },
    },
  })
  verify(@Param("id") id: string, @Body() body: unknown, @Res() res: Response) {
    return this.forward(
      `payments/orders/${encodeURIComponent(id)}/verify`,
      res,
      body,
    );
  }
  @Get("payments/orders/:id/audit") audit(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    return this.forward(`payments/orders/${encodeURIComponent(id)}/audit`, res);
  }
}
@Module({ controllers: [GatewayController], providers: [PaymentsHttpClient] })
export class GatewayModule {}
export async function createGatewayApp() {
  const app = await NestFactory.create(GatewayModule, {
    logger: ["error", "warn"],
  });
  app.use(requestContext);
  app.useGlobalFilters(new PublicErrorFilter());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  });
  app.enableShutdownHooks();
  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("ARVELUNA Gateway")
        .setVersion("1")
        .build(),
    ),
  );
  return app;
}
if (require.main === module)
  void createGatewayApp().then((app) =>
    app.listen(Number(process.env.GATEWAY_PORT ?? 3000), "127.0.0.1"),
  );
