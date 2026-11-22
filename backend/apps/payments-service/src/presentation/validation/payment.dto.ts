import { IsIn, IsString, Matches, MaxLength } from "class-validator";
import { PAYMENT_HASH } from "../../domain/services/transaction-hash";
import { ApiProperty } from "@nestjs/swagger";
export class CreateOrderDto {
  @ApiProperty({ example: "SALE-001" })
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  saleId!: string;
  @ApiProperty({ example: "MERCHANT-001" })
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  merchantId!: string;
  @ApiProperty({ example: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8" })
  @Matches(/^(?:T[1-9A-HJ-NP-Za-km-z]{33}|(?:0x)?(?:41)?[a-fA-F0-9]{40})$/)
  recipientAddress!: string;
  @ApiProperty({ example: "10.00" }) @IsString() @MaxLength(28) amount!: string;
}
export class VerifyDto {
  @ApiProperty({ example: "demo:valid:001" })
  @Matches(
    /^(?:[a-fA-F0-9]{64}|demo:(?:valid|missing|token|recipient|amount|pending|multi|unavailable|timeout|network|failed):[a-zA-Z0-9_-]{1,40})$/,
  )
  transactionHash!: string;
}

export class FullVerifyDto {
  @ApiProperty({ type: String, example: "demo:valid:001" })
  @IsString()
  @Matches(PAYMENT_HASH)
  transactionHash!: string;
}

export class SaleCheckoutDto {
  @ApiProperty({ type: String })
  @IsString()
  @Matches(/^[\w-]{1,120}$/)
  merchantId!: string;

  @ApiProperty({ type: String })
  @IsString()
  @Matches(/^[\w-]{1,120}$/)
  saleId!: string;

  @ApiProperty({ type: String, enum: ["USDT", "ARVE"] })
  @IsIn(["USDT", "ARVE"])
  asset!: string;

  @ApiProperty({ type: String, example: "10.000000" })
  @IsString()
  @Matches(/^(?!0\.0{6}$)(0|[1-9]\d{0,19})\.\d{6}$/)
  amount!: string;
}
