import { PrismaClient } from "@arveluna/merchant-db";
import type { Merchants } from "../application/merchant";
import type { Wallet } from "../domain/merchant";

export class PrismaMerchants implements Merchants {
  constructor(readonly db = new PrismaClient()) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  get(id: string) {
    return this.db.merchant.findUnique({
      where: { id },
      include: { wallets: true },
    });
  }
  rename(id: string, name: string) {
    return this.db.merchant.update({ where: { id }, data: { name } });
  }
  saveWallet(wallet: Wallet) {
    const { merchantId, network, asset, address } = wallet;
    return this.db.wallet.upsert({
      where: { merchantId_network_asset: { merchantId, network, asset } },
      create: wallet,
      update: { address },
    });
  }
  getWallet(merchantId: string, network: string, asset: string) {
    return this.db.wallet.findUnique({
      where: { merchantId_network_asset: { merchantId, network, asset } },
    });
  }
}
