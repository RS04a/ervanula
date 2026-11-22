import { ANALYTICS_PAGE_SIZE } from "../../../../libs/full-app/contract";
import { optionalChoice } from "../../../../libs/full-app/contract";
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
import { fault } from "../../../../libs/full-app/contract";
import { offset } from "../../../../libs/full-app/money";
import { CashRegister } from "../application/cash";
import { PrismaCash } from "../infrastructure/prisma";

@Controller("internal/cash")
class CashController {
  constructor(
    @Inject(CashRegister) private readonly cash: CashRegister,
    @Inject(PrismaCash) private readonly repository: PrismaCash,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("register") async register(@Req() req: Request) {
    return this.cash.db.register((await actorFor(req, "cash")).merchantId);
  }
  @Get("sessions") async sessions(
    @Req() req: Request,
    @Query("offset") page?: string,
  ) {
    return this.cash.db.sessions(
      (await actorFor(req, "cash")).merchantId,
      offset(page),
    );
  }
  @Get("movements") async movements(
    @Req() req: Request,
    @Query("offset") page?: string,
    @Query("asset") filter?: string,
  ) {
    return this.cash.db.movements(
      (await actorFor(req, "cash")).merchantId,
      offset(page),
      optionalChoice(filter, ["COP", "USDT", "ARVE"]),
    );
  }
  @Post("open") async open(@Req() req: Request, @Body() input: unknown) {
    return this.cash.open(await actorFor(req, "cash"), input);
  }
  @Post("close") async close(@Req() req: Request, @Body() input: unknown) {
    return this.cash.close(await actorFor(req, "cash"), input);
  }
  @Post("movements") async movement(
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    return this.cash.manual(await actorFor(req, "cash"), input);
  }
  @Get("active/:merchantId") async active(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
  ) {
    authenticateService(req, ["sales"]);
    const data = await this.repository.register(merchantId);
    if (!data.session)
      fault(
        409,
        "CASH_CLOSED",
        "Abre una sesión de caja para iniciar el cobro",
      );
    return { id: data.session.id };
  }
  @Post("settlement") settle(@Req() req: Request, @Body() input: unknown) {
    authenticateService(req, ["sales"]);
    return this.cash.settle(input);
  }
  @Get("read/:merchantId") read(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Query("offset") page?: string,
  ) {
    authenticateService(req, ["analytics"]);
    return this.cash.db.sessions(merchantId, offset(page), ANALYTICS_PAGE_SIZE);
  }
}
@Module({
  controllers: [CashController],
  providers: [
    { provide: PrismaCash, useFactory: () => new PrismaCash() },
    {
      provide: CashRegister,
      inject: [PrismaCash],
      useFactory: (db: PrismaCash) => new CashRegister(db),
    },
  ],
})
export class CashModule {}
