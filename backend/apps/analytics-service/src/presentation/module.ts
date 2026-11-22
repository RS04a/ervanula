import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { actorFor } from "../../../../libs/full-app/service-http";
import { integer } from "../../../../libs/full-app/money";
import { Broker } from "../../../../libs/full-app/broker";
import { Worker } from "../../../../libs/full-app/worker";
import { Analytics } from "../application/analytics";
import { PrismaReadModels } from "../infrastructure/prisma";
import { collect } from "../infrastructure/collect";

@Controller("internal/analytics")
class AnalyticsController {
  constructor(
    @Inject(Analytics) private readonly analytics: Analytics,
    @Inject(PrismaReadModels) private readonly repository: PrismaReadModels,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("diagnostics") async report(
    @Req() req: Request,
    @Query("days") days = "30",
  ) {
    return this.analytics.report(
      (await actorFor(req, "analytics")).merchantId,
      integer(Number(days), "periodo", 1, 365),
      "diagnostics",
    );
  }
  @Get("recommendations") async recommendations(
    @Req() req: Request,
    @Query("days") days = "30",
  ) {
    return this.analytics.report(
      (await actorFor(req, "analytics")).merchantId,
      integer(Number(days), "periodo", 1, 365),
      "recommendations",
    );
  }
  @Post("simulate") async simulate(
    @Req() req: Request,
    @Body() value: unknown,
  ) {
    return this.analytics.simulate(
      (await actorFor(req, "analytics")).merchantId,
      value,
    );
  }
  @Post("reconcile") async reconcile(@Req() req: Request) {
    return this.analytics.rebuild(
      (await actorFor(req, "analytics")).merchantId,
    );
  }
}
@Module({
  controllers: [AnalyticsController],
  providers: [
    { provide: PrismaReadModels, useFactory: () => new PrismaReadModels() },
    {
      provide: Analytics,
      inject: [PrismaReadModels],
      useFactory: (models: PrismaReadModels) => new Analytics(models, collect),
    },
    {
      provide: Worker,
      inject: [Analytics],
      useFactory: (analytics: Analytics) =>
        new Worker("analytics.reconcile", () => analytics.reconcile(), 3000),
    },
    {
      provide: Broker,
      inject: [PrismaReadModels],
      useFactory: (models: PrismaReadModels) =>
        new Broker("analytics", undefined, (message) => models.event(message)),
    },
  ],
})
export class AnalyticsModule {}
