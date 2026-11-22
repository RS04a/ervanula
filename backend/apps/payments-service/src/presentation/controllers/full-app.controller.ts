import { ANALYTICS_PAGE_SIZE } from "../../../../../libs/full-app/contract";
import { optionalChoice } from "../../../../../libs/full-app/contract";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  ValidationPipe,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  actorFor,
  authenticateService,
} from "../../../../../libs/full-app/service-http";
import { ApiBody } from "@nestjs/swagger";
import { FullVerifyDto, SaleCheckoutDto } from "../validation/payment.dto";
const dto = (expectedType: typeof FullVerifyDto | typeof SaleCheckoutDto) =>
  new ValidationPipe({
    expectedType,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
import { offset } from "../../../../../libs/full-app/money";
import { SalePayments } from "../../application/sale-payments";
import { GetPaymentAudit } from "../../application/use-cases/payments";
import { AppConfig } from "../../infrastructure/config/config";

@Controller("internal/payments")
export class FullPaymentsController {
  constructor(
    @Inject(SalePayments) private readonly payments: SalePayments,
    @Inject(GetPaymentAudit) private readonly audit: GetPaymentAudit,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}
  @Get("settings") async settings(@Req() request: Request) {
    await actorFor(request, "payments");
    return {
      provider: this.config.provider,
      network: this.config.network,
      assets: this.config.arve ? ["USDT", "ARVE"] : ["USDT"],
      arve: this.config.arve
        ? {
            network: this.config.arve.network,
            provider: this.config.arve.provider,
          }
        : null,
    };
  }
  @Get("orders") async orders(
    @Req() req: Request,
    @Query("offset") page?: string,
    @Query("status") filter?: string,
  ) {
    return this.payments.db.page(
      (await actorFor(req, "payments")).merchantId,
      offset(page),
      optionalChoice(filter, [
        "PENDING",
        "DETECTED",
        "CONFIRMING",
        "CONFIRMED",
        "REJECTED",
        "EXPIRED",
      ]),
    );
  }
  @Get("orders/:id") async get(@Req() req: Request, @Param("id") id: string) {
    return this.payments.order(
      (await actorFor(req, "payments")).merchantId,
      id,
    );
  }
  @Get("orders/:id/audit") async history(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    await this.get(req, id);
    return this.audit.execute(id);
  }
  @Post("orders/:id/verify")
  @ApiBody({ type: FullVerifyDto })
  async verify(
    @Req() req: Request,
    @Param("id") id: string,
    @Body(dto(FullVerifyDto)) input: FullVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.payments.check(
      (await actorFor(req, "payments")).merchantId,
      id,
      input.transactionHash,
      res.locals.requestId,
    );
  }
  @Post("checkout")
  @ApiBody({ type: SaleCheckoutDto })
  checkout(
    @Req() req: Request,
    @Body(dto(SaleCheckoutDto)) body: SaleCheckoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    authenticateService(req, ["sales"]);
    return this.payments.checkout(body, res.locals.requestId);
  }
  @Get("checkout/:merchantId/:id") status(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Param("id") id: string,
  ) {
    authenticateService(req, ["sales"]);
    return this.payments.order(merchantId, id);
  }
  @Get("read/:merchantId") read(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Query("offset") page?: string,
  ) {
    authenticateService(req, ["analytics"]);
    return this.payments.db.page(
      merchantId,
      offset(page),
      undefined,
      ANALYTICS_PAGE_SIZE,
    );
  }
}
