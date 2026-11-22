import { ANALYTICS_PAGE_SIZE } from "../../../../libs/full-app/contract";
import { optionalChoice } from "../../../../libs/full-app/contract";
import { Broker, Outbox } from "../../../../libs/full-app/broker";
import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  actorFor,
  authenticateService,
} from "../../../../libs/full-app/service-http";
import { offset } from "../../../../libs/full-app/money";
import { Worker } from "../../../../libs/full-app/worker";
import { Sales } from "../application/sales";
import { PrismaSales } from "../infrastructure/prisma";
import { HttpSaleOperations } from "../infrastructure/operations";

@Controller("internal/sales")
class SalesController {
  constructor(
    @Inject(Sales) private readonly sales: Sales,
    @Inject(PrismaSales) private readonly repository: PrismaSales,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("sales") async list(
    @Req() req: Request,
    @Query("offset") page?: string,
    @Query("status") filter?: string,
  ) {
    return this.sales.db.list(
      (await actorFor(req, "sales")).merchantId,
      offset(page),
      optionalChoice(filter, [
        "DRAFT",
        "RESERVING",
        "OPENING_PAYMENT",
        "AWAITING_PAYMENT",
        "RECORDING_CASH",
        "PAYMENT_CONFIRMED",
        "INVENTORY_CONSUMED",
        "RELEASING",
        "COMPLETED",
        "CANCELLED",
        "REVIEW",
      ]),
    );
  }
  @Get("sales/:id") async get(@Req() req: Request, @Param("id") id: string) {
    return this.sales.get(await actorFor(req, "sales"), id);
  }
  @Post("sales") async create(@Req() req: Request, @Body() input: unknown) {
    return this.sales.create(await actorFor(req, "sales"), input);
  }
  @Post("sales/:id/items") async item(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    return this.sales.item(await actorFor(req, "sales"), id, input);
  }
  @Post("sales/:id/checkout") async checkout(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.sales.checkout(await actorFor(req, "sales"), id);
  }
  @Post("sales/:id/cancel") async cancel(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.sales.db.cancel((await actorFor(req, "sales")).merchantId, id);
  }
  @Get("read/:merchantId") read(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Query("offset") page?: string,
  ) {
    authenticateService(req, ["analytics"]);
    return this.sales.db.list(
      merchantId,
      offset(page),
      undefined,
      ANALYTICS_PAGE_SIZE,
    );
  }
}
@Module({
  controllers: [SalesController],
  providers: [
    { provide: PrismaSales, useFactory: () => new PrismaSales() },
    {
      provide: Broker,
      inject: [PrismaSales, Sales],
      useFactory: (db: PrismaSales, sales: Sales) =>
        new Broker("sales", new Outbox(db.db), (message) =>
          sales.receive(message),
        ),
    },
    {
      provide: Sales,
      inject: [PrismaSales],
      useFactory: (db: PrismaSales) => new Sales(db, new HttpSaleOperations()),
    },
    {
      provide: Worker,
      inject: [Sales],
      useFactory: (sales: Sales) =>
        new Worker("sales.saga", () => sales.step()),
    },
  ],
})
export class SalesModule {}
