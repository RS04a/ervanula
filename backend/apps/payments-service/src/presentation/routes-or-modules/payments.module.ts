import { Broker, Outbox } from "../../../../../libs/full-app/broker";
import { call } from "../../../../../libs/full-app/service-http";
import { Worker } from "../../../../../libs/full-app/worker";
import { SalePayments } from "../../application/sale-payments";
import { FullPaymentsController } from "../controllers/full-app.controller";
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
const providers = [
  { provide: AppConfig, useFactory: () => new AppConfig() },
  StructuredLogger,
  {
    provide: PrismaPaymentRepositories,
    inject: [AppConfig],
    useFactory: (c: AppConfig) =>
      new PrismaPaymentRepositories(
        new PrismaClient({ datasourceUrl: c.databaseUrl }),
        process.env.ARVELUNA_FULL_APP === "true",
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
];
@Module({
  controllers: [PaymentsController, HealthController],
  providers,
  exports: [AppConfig, BlockchainProviderProxy, PrismaPaymentRepositories],
})
export class PaymentsModule {}

@Module({
  controllers: [FullPaymentsController, HealthController],
  providers: [
    ...providers,
    {
      provide: SalePayments,
      inject: [
        PrismaPaymentRepositories,
        CreatePaymentOrder,
        VerifyPayment,
        BlockchainProviderProxy,
        TronUsdtVerificationStrategy,
        AppConfig,
        StructuredLogger,
      ],
      useFactory: (
        db: PrismaPaymentRepositories,
        create: CreatePaymentOrder,
        verify: VerifyPayment,
        proxy: BlockchainProviderProxy,
        strategy: TronUsdtVerificationStrategy,
        config: AppConfig,
        logger: StructuredLogger,
      ) => {
        const arve = config.arve;
        const arveProxy = arve
          ? new BlockchainProviderProxy(
              selectBlockchainProvider(arve),
              config.timeout,
              config.retries,
              logger,
            )
          : undefined;
        const arveStrategy = arve
          ? new TronUsdtVerificationStrategy(arve.minConfirmations)
          : undefined;
        return new SalePayments(
          db,
          create,
          {
            receiver: async (merchantId, network, asset) => {
              const wallet = await call<{ address: string }>(
                "payments",
                "merchant",
                `merchant/receiver/${merchantId}/${network}/${asset}`,
              );
              return wallet.address;
            },
          },
          {
            USDT: {
              network: config.network,
              contract: config.contract,
              simulated: config.provider === "simulated",
              provider: proxy,
              verify,
              strategy,
            },
            ARVE:
              arve && arveProxy && arveStrategy
                ? {
                    network: arve.network,
                    contract: arve.contract,
                    simulated: arve.provider === "simulated",
                    provider: arveProxy,
                    strategy: arveStrategy,
                    verify: new VerifyPayment(db, db, arveProxy, arveStrategy),
                  }
                : undefined,
          },
        );
      },
    },
    {
      provide: Broker,
      inject: [PrismaPaymentRepositories],
      useFactory: (db: PrismaPaymentRepositories) =>
        new Broker("payments", new Outbox(db.client)),
    },
    {
      provide: Worker,
      inject: [SalePayments],
      useFactory: (payments: SalePayments) =>
        new Worker("payments.expiry", () => payments.expire()),
    },
  ],
})
export class FullPaymentsModule {}
