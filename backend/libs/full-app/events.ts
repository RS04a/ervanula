import { randomUUID } from "node:crypto";

export type Topic =
  | "inventory.stock-changed.v1"
  | "payment.confirmed.v1"
  | "payment.expired.v1"
  | "payment.late.v1"
  | "sale.completed.v1";
export type Event = {
  eventId: string;
  version: 1;
  topic: Topic;
  correlationId: string;
  merchantId: string;
  occurredAt: string;
  data: Record<string, string | number>;
};
export function event(
  topic: Topic,
  merchantId: string,
  correlationId: string,
  data: Event["data"],
): Event {
  return {
    eventId: randomUUID(),
    version: 1,
    topic,
    correlationId,
    merchantId,
    occurredAt: new Date().toISOString(),
    data,
  };
}
