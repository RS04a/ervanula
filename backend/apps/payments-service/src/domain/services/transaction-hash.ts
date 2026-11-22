export const DEMO_SCENARIOS = [
  "valid",
  "missing",
  "token",
  "recipient",
  "amount",
  "pending",
  "multi",
  "unavailable",
  "timeout",
  "network",
  "failed",
] as const;
export const DEMO_HASH = new RegExp(
  `^demo:(?:${DEMO_SCENARIOS.join("|")}):[a-zA-Z0-9_-]{1,72}$`,
);
export const PAYMENT_HASH = new RegExp(
  `^(?:[a-fA-F0-9]{64}|${DEMO_HASH.source.slice(1, -1)})$`,
);
