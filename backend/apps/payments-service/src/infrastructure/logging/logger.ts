import { requestStorage } from "../../../../../libs/contracts/http";
import { Logger } from "../../application/ports/ports";
export class StructuredLogger implements Logger {
  log(
    level: string,
    operation: string,
    requestId: string,
    context: Record<string, unknown>,
  ) {
    console.log(
      JSON.stringify({
        level,
        operation,
        requestId: requestStorage.getStore()?.requestId ?? requestId,
        ...context,
      }),
    );
  }
}
