import type { diagnostics } from "./diagnostics";

export function recommendations(report: ReturnType<typeof diagnostics>) {
  const groups = new Map<string, typeof report.paymentFailures>();
  for (const payment of report.paymentFailures) {
    const code = payment.failureCode ?? payment.status;
    groups.set(code, [...(groups.get(code) ?? []), payment]);
  }
  return {
    start: report.start,
    end: report.end,
    days: report.days,
    rules: [
      {
        action: "Reponer existencias",
        rule: "Disponible < mínimo",
        threshold: "Mínimo por producto",
        period: "Estado del corte",
        sufficient: report.sufficient.products,
        findings: report.lowStock,
      },
      {
        action: "Revisar productos sin movimiento",
        rule: "Sin movimiento y con antigüedad de al menos el periodo",
        threshold: report.days,
        period: "Días anteriores al corte",
        sufficient: report.sufficient.matureProducts,
        findings: report.dormant,
      },
      {
        action: "Revisar diferencias de caja",
        rule: "Contado − esperado distinto de cero",
        threshold: "0 COP",
        period: "Cierres del periodo",
        sufficient: report.sufficient.cash,
        findings: report.cashDifferences,
      },
      {
        action: "Revisar fallos de cobro",
        rule: "Al menos 2 órdenes fallidas con el mismo código",
        threshold: 2,
        period: "Órdenes actualizadas en el periodo",
        sufficient: report.sufficient.payments,
        findings: [...groups]
          .filter(([, payments]) => payments.length >= 2)
          .map(([code, payments]) => ({
            code,
            count: payments.length,
            orders: payments.map((p) => p.id),
          })),
      },
    ],
  };
}
