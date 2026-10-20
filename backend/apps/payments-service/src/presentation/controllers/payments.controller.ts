import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Res,
  Inject,
  ValidationPipe,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import {
  CreatePaymentOrder,
  GetPaymentOrder,
  VerifyPayment,
  GetPaymentAudit,
} from "../../application/use-cases/payments";
import { CreateOrderDto, VerifyDto } from "../validation/payment.dto";
@ApiTags("payments")
@Controller("internal")
export class PaymentsController {
  constructor(
    @Inject(CreatePaymentOrder) private readonly create: CreatePaymentOrder,
    @Inject(GetPaymentOrder) private readonly get: GetPaymentOrder,
    @Inject(VerifyPayment) private readonly verify: VerifyPayment,
    @Inject(GetPaymentAudit) private readonly audit: GetPaymentAudit,
  ) {}
  @Post("payments/orders") createOrder(
    @Body(
      new ValidationPipe({
        expectedType: CreateOrderDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    input: CreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.create.execute(input, res.locals.requestId);
  }
  @Get("payments/orders/:id") getOrder(@Param("id") id: string) {
    return this.get.execute(id);
  }
  @Post("payments/orders/:id/verify") verifyOrder(
    @Param("id") id: string,
    @Body(
      new ValidationPipe({
        expectedType: VerifyDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    input: VerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.verify.execute(id, input.transactionHash, res.locals.requestId);
  }
  @Get("payments/orders/:id/audit") getAudit(@Param("id") id: string) {
    return this.audit.execute(id);
  }
}
