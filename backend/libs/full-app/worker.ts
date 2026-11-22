export class Worker {
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private closed = false;
  constructor(
    private readonly name: string,
    private readonly work: () => Promise<unknown>,
    private readonly interval = 500,
  ) {}
  onModuleInit() {
    this.schedule(0);
  }
  async onModuleDestroy() {
    this.closed = true;
    clearTimeout(this.timer);
    await this.running;
  }
  private schedule(delay: number) {
    if (this.closed) return;
    this.timer = setTimeout(() => {
      this.running = this.work()
        .then(
          () => undefined,
          () => {
            console.warn(
              JSON.stringify({
                level: "warn",
                operation: this.name,
                code: "WORK_RETRY",
              }),
            );
          },
        )
        .finally(() => this.schedule(this.interval));
    }, delay);
    this.timer.unref();
  }
}
