import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const client = new PrismaClient();
async function seed() {
  await client.paymentOrder.upsert({
    where: { id: "demo-seed-order" },
    update: {},
    create: {
      id: "demo-seed-order",
      saleId: "SALE-SEED",
      merchantId: "MERCHANT-001",
      network: "mainnet",
      tokenSymbol: "USDT",
      tokenContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      recipientAddress: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
      amountBaseUnits: "10000000",
      tokenDecimals: 6,
      expiresAt: new Date("2030-01-01"),
    },
  });
}
void seed().finally(() => client.$disconnect());
