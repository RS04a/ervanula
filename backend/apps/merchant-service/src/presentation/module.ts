import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  actorFor,
  authenticateService,
} from "../../../../libs/full-app/service-http";
import { normalizeTronAddress } from "../../../../libs/full-app/tron-address";
import { MerchantProfile } from "../application/merchant";
import { PrismaMerchants } from "../infrastructure/prisma";

@Controller("internal/merchant")
class MerchantController {
  constructor(
    @Inject(MerchantProfile) private readonly merchant: MerchantProfile,
    @Inject(PrismaMerchants) private readonly repository: PrismaMerchants,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("profile") async profile(@Req() req: Request) {
    return this.merchant.profile((await actorFor(req, "merchant")).merchantId);
  }
  @Post("profile") async rename(@Req() req: Request, @Body() input: unknown) {
    return this.merchant.rename(await actorFor(req, "merchant"), input);
  }
  @Post("wallets") async wallet(@Req() req: Request, @Body() input: unknown) {
    return this.merchant.wallet(await actorFor(req, "merchant"), input);
  }
  @Get("receiver/:merchantId/:network/:asset") receiver(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Param("network") network: string,
    @Param("asset") asset: string,
  ) {
    authenticateService(req, ["payments"]);
    return this.merchant.receiver(merchantId, network, asset);
  }
}
@Module({
  controllers: [MerchantController],
  providers: [
    { provide: PrismaMerchants, useFactory: () => new PrismaMerchants() },
    {
      provide: MerchantProfile,
      inject: [PrismaMerchants],
      useFactory: (db: PrismaMerchants) =>
        new MerchantProfile(db, normalizeTronAddress),
    },
  ],
})
export class MerchantModule {}
