import { Controller, Get, Inject, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PaymentsController } from "../controllers/payments.controller";
import { AppConfig } from "../../infrastructure/config/config";
import { PrismaPaymentRepositories } from "../../infrastructure/database/prisma.repositories";
import { selectBlockchainProvider } from "../../infrastructure/blockchain/provider.factory";
import { BlockchainProviderProxy } from "../../infrastructure/blockchain/provider.proxy";
import { StructuredLogger } from "../../infrastructure/logging/logger";
import { TronUsdtVerificationStrategy } from "../../application/tron-usdt-verification.strategy";
import {
  CreatePaymentOrder,
  GetPaymentOrder,
  GetPaymentAudit,
  VerifyPayment,
} from "../../application/use-cases/payments";
@Controller("internal/health")
class HealthController {
  constructor(
    @Inject(PrismaPaymentRepositories)
    private readonly repository: PrismaPaymentRepositories,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}
  @Get() async health() {
    await this.repository.client.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      service: "payments",
      provider: this.config.provider,
      network: this.config.network,
    };
  }
}
@Module({
  controllers: [PaymentsController, HealthController],
  providers: [
    { provide: AppConfig, useFactory: () => new AppConfig() },
    StructuredLogger,
    {
      provide: PrismaPaymentRepositories,
      inject: [AppConfig],
      useFactory: (c: AppConfig) =>
        new PrismaPaymentRepositories(
          new PrismaClient({ datasourceUrl: c.databaseUrl }),
        ),
    },
    {
      provide: BlockchainProviderProxy,
      inject: [AppConfig, StructuredLogger],
      useFactory: (c: AppConfig, l: StructuredLogger) =>
        new BlockchainProviderProxy(
          selectBlockchainProvider(c),
          c.timeout,
          c.retries,
          l,
        ),
    },
    {
      provide: TronUsdtVerificationStrategy,
      inject: [AppConfig],
      useFactory: (c: AppConfig) =>
        new TronUsdtVerificationStrategy(c.minConfirmations),
    },
    {
      provide: CreatePaymentOrder,
      inject: [PrismaPaymentRepositories, AppConfig],
      useFactory: (r: PrismaPaymentRepositories, c: AppConfig) =>
        new CreatePaymentOrder(r, c),
    },
    {
      provide: GetPaymentOrder,
      inject: [PrismaPaymentRepositories],
      useFactory: (r: PrismaPaymentRepositories) => new GetPaymentOrder(r),
    },
    {
      provide: GetPaymentAudit,
      inject: [GetPaymentOrder, PrismaPaymentRepositories],
      useFactory: (g: GetPaymentOrder, r: PrismaPaymentRepositories) =>
        new GetPaymentAudit(g, r),
    },
    {
      provide: VerifyPayment,
      inject: [
        PrismaPaymentRepositories,
        BlockchainProviderProxy,
        TronUsdtVerificationStrategy,
      ],
      useFactory: (
        r: PrismaPaymentRepositories,
        p: BlockchainProviderProxy,
        s: TronUsdtVerificationStrategy,
      ) => new VerifyPayment(r, r, p, s),
    },
  ],
  exports: [AppConfig, BlockchainProviderProxy, PrismaPaymentRepositories],
})
export class PaymentsModule {}
