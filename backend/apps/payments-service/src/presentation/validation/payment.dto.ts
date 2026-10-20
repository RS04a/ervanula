import { IsString, Matches, MaxLength } from "class-validator";
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
  @Matches(/^T[1-9A-HJ-NP-Za-km-z]{33}$/)
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
