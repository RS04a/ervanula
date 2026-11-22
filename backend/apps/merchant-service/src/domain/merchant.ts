export interface Merchant {
  id: string;
  name: string;
}
export interface Wallet {
  merchantId: string;
  asset: string;
  network: string;
  address: string;
}
