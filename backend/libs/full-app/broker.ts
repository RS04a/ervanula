import { randomUUID } from "node:crypto";
import amqp, { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { Event, Topic } from "./events";
import { Worker } from "./worker";

const exchange = "arveluna.domain.v1";
const subscriptions: Record<string, Topic[]> = {
  sales: ["payment.confirmed.v1", "payment.expired.v1", "payment.late.v1"],
  analytics: [
    "sale.completed.v1",
    "inventory.stock-changed.v1",
    "payment.confirmed.v1",
    "payment.expired.v1",
    "payment.late.v1",
  ],
};
interface OutboxRow {
  id: string;
  topic: string;
  payload: unknown;
  leaseToken: string;
}
interface SqlOutbox {
  $queryRaw<T>(query: TemplateStringsArray, ...params: unknown[]): Promise<T>;
  $executeRaw(
    query: TemplateStringsArray,
    ...params: unknown[]
  ): Promise<number>;
}
export class Outbox {
  constructor(private readonly db: SqlOutbox) {}
  async next(): Promise<OutboxRow | null> {
    const [candidate] = await this.db.$queryRaw<
      { id: string }[]
    >`SELECT id FROM Outbox
      WHERE sentAt IS NULL AND (leaseUntil IS NULL OR leaseUntil < CURRENT_TIMESTAMP(3))
      ORDER BY createdAt, id LIMIT 1`;
    if (!candidate) return null;
    const leaseToken = randomUUID();
    const count = await this.db
      .$executeRaw`UPDATE Outbox SET leaseToken = ${leaseToken},
      leaseUntil = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 15 SECOND)
      WHERE id = ${candidate.id} AND sentAt IS NULL AND (leaseUntil IS NULL OR leaseUntil < CURRENT_TIMESTAMP(3))`;
    if (!count) return null;
    const [row] = await this.db.$queryRaw<
      OutboxRow[]
    >`SELECT id, topic, payload, leaseToken FROM Outbox WHERE id = ${candidate.id} AND leaseToken = ${leaseToken}`;
    return row ?? null;
  }
  async sent(row: OutboxRow) {
    await this.db
      .$executeRaw`UPDATE Outbox SET sentAt = CURRENT_TIMESTAMP(3), leaseToken = NULL, leaseUntil = NULL
      WHERE id = ${row.id} AND leaseToken = ${row.leaseToken}`;
  }
}
function parse(message: ConsumeMessage, name: string): Event {
  const data = JSON.parse(message.content.toString("utf8")) as Event;
  if (
    !data ||
    data.version !== 1 ||
    !subscriptions[name].includes(data.topic) ||
    data.eventId !== message.properties.messageId ||
    !/^[a-f0-9-]{36}$/.test(data.eventId) ||
    typeof data.correlationId !== "string" ||
    !data.correlationId ||
    typeof data.merchantId !== "string" ||
    !data.merchantId ||
    !Number.isFinite(Date.parse(data.occurredAt)) ||
    typeof data.data !== "object" ||
    !data.data ||
    Array.isArray(data.data)
  )
    throw new Error("Evento inválido");
  return data;
}
export class Broker {
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private readonly worker: Worker;
  private readonly consumers = new Set<Promise<void>>();
  constructor(
    private readonly name: string,
    private readonly store?: Outbox,
    private readonly handle?: (event: Event) => Promise<void>,
  ) {
    this.worker = new Worker(`${name}.broker`, () => this.tick(), 1500);
  }
  onModuleInit() {
    this.worker.onModuleInit();
  }
  async onModuleDestroy() {
    await this.worker.onModuleDestroy();
    await this.connection?.close().catch(() => undefined);
    await Promise.allSettled(this.consumers);
  }
  private async connect() {
    const url = process.env.RABBITMQ_URL;
    if (!url) throw new Error("RABBITMQ_URL requerida");
    const connection = await amqp.connect(url, { timeout: 3000 });
    this.connection = connection;
    connection.on("error", () => undefined);
    connection.once("close", () => {
      if (this.connection === connection) {
        this.connection = undefined;
        this.channel = undefined;
      }
    });
    try {
      const channel = await connection.createConfirmChannel();
      channel.on("error", () => undefined);
      channel.once("close", () => {
        if (this.channel === channel) this.channel = undefined;
      });
      await channel.assertExchange(exchange, "topic", { durable: true });
      for (const [owner, topics] of Object.entries(subscriptions)) {
        const queue = `arveluna.${owner}.v1`;
        await channel.assertQueue(queue, { durable: true });
        await channel.assertQueue(`${queue}.dead`, { durable: true });
        await channel.assertQueue(`${queue}.retry`, {
          durable: true,
          messageTtl: 3000,
          deadLetterExchange: "",
          deadLetterRoutingKey: queue,
        });
        for (const topic of topics)
          await channel.bindQueue(queue, exchange, topic);
      }
      if (this.handle) {
        await channel.prefetch(4);
        await channel.consume(
          `arveluna.${this.name}.v1`,
          (message) => {
            if (!message) return;
            const work = this.consume(channel, message)
              .catch(() => {
                void connection.close().catch(() => undefined);
              })
              .finally(() => this.consumers.delete(work));
            this.consumers.add(work);
          },
          { noAck: false },
        );
      }
      this.channel = channel;
      return channel;
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
  }
  private async confirm(
    channel: ConfirmChannel,
    destination: string,
    key: string,
    content: Buffer,
    id: string,
    attempts: number,
  ) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Confirmación agotada")),
        4000,
      );
      channel.publish(
        destination,
        key,
        content,
        {
          persistent: true,
          contentType: "application/json",
          messageId: id,
          headers: { attempts },
        },
        (error) => {
          clearTimeout(timer);
          if (error) reject(error);
          else resolve();
        },
      );
    });
  }
  private async consume(channel: ConfirmChannel, message: ConsumeMessage) {
    try {
      await this.handle?.(parse(message, this.name));
    } catch {
      const prior = message.properties.headers?.attempts;
      const attempts =
        typeof prior === "number" && Number.isSafeInteger(prior) && prior >= 0
          ? prior + 1
          : 1;
      const queue = `arveluna.${this.name}.v1.${attempts > 3 ? "dead" : "retry"}`;
      await this.confirm(
        channel,
        "",
        queue,
        message.content,
        message.properties.messageId,
        attempts,
      );
    }
    channel.ack(message);
  }
  private async tick() {
    const channel = this.channel ?? (await this.connect());
    if (!this.store) return;
    for (let count = 0; count < 20; count++) {
      const row = await this.store.next();
      if (!row) return;
      const payload =
        typeof row.payload === "string"
          ? row.payload
          : JSON.stringify(row.payload);
      try {
        await this.confirm(
          channel,
          exchange,
          row.topic,
          Buffer.from(payload),
          row.id,
          0,
        );
      } catch (error) {
        await this.connection?.close().catch(() => undefined);
        throw error;
      }
      await this.store.sent(row);
    }
  }
}
