import {
  Actor,
  fault,
  field,
  object,
  requireAdmin,
} from "../../../../libs/full-app/contract";
import { Merchant, Wallet } from "../domain/merchant";

export interface Merchants {
  get(id: string): Promise<(Merchant & { wallets: Wallet[] }) | null>;
  rename(id: string, name: string): Promise<Merchant>;
  saveWallet(wallet: Wallet): Promise<Wallet>;
  getWallet(
    merchantId: string,
    network: string,
    asset: string,
  ): Promise<Wallet | null>;
}
export class MerchantProfile {
  constructor(
    private readonly db: Merchants,
    private readonly address: (value: string) => string,
  ) {}
  async profile(id: string) {
    const merchant = await this.db.get(id);
    if (!merchant) fault(404, "NOT_FOUND", "Comercio inexistente");
    return merchant;
  }
  async rename(actor: Actor, value: unknown) {
    requireAdmin(actor);
    await this.profile(actor.merchantId);
    return this.db.rename(
      actor.merchantId,
      field(object(value).name, "nombre"),
    );
  }
  async wallet(actor: Actor, value: unknown) {
    requireAdmin(actor);
    const input = object(value);
    const network = field(input.network, "red");
    const asset = field(input.asset, "activo");
    if (
      !["mainnet", "nile", "shasta"].includes(network) ||
      !["USDT", "ARVE"].includes(asset)
    )
      fault(400, "INVALID_ASSET", "Perfil de red y activo inválido");
    let address: string;
    try {
      address = this.address(field(input.address, "dirección", 64));
    } catch {
      fault(400, "INVALID_ADDRESS", "Dirección TRON inválida");
    }
    await this.profile(actor.merchantId);
    return this.db.saveWallet({
      merchantId: actor.merchantId,
      network,
      asset,
      address,
    });
  }
  async receiver(merchantId: string, network: string, asset: string) {
    const wallet = await this.db.getWallet(merchantId, network, asset);
    if (!wallet)
      fault(
        409,
        "WALLET_MISSING",
        "Configura la billetera receptora del comercio",
      );
    return wallet;
  }
}
