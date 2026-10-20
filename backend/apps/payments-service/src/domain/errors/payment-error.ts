import { PaymentFailureCode } from "../entities/models";
export class PaymentError extends Error {
  constructor(
    public readonly code:
      | PaymentFailureCode
      | "NOT_FOUND"
      | "INVALID_REQUEST"
      | "COMMUNICATION_ERROR",
    message: string,
    public readonly retryable = false,
    public readonly httpStatus = 422,
  ) {
    super(message);
  }
}
