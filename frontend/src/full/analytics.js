import { adminUrl } from "./routes.js";
import {
  assetLabel,
  button,
  callout,
  date,
  el,
  empty,
  form,
  heading,
  money,
  metricCard,
  panel,
  pill,
  paymentProfiles,
  short,
  table,
} from "./ui.js";
import { productChoice } from "./operations.js";

function updated(report) {
  return el(
    "p",
    { class: "note", role: "status" },
    `Corte ${date(report.lastUpdated)}${report.stale ? " · sincronización pendiente" : ""}`,
  );
}
function controls(ctx) {
  return el(
    "div",
    { class: "actions" },
    form(
      "Aplicar periodo",
      [
        [
          "days",
          "Días anteriores al corte",
          { type: "number", min: 1, max: 365, value: ctx.state.days ?? 30 },
        ],
      ],
      ({ days }) => ctx.go({ days: Number(days) }),
    ),
    button("Reconciliar datos", () => ctx.action("analytics/reconcile")),
  );
}
export async function dashboard(ctx) {
  const [report, register, payments, recent] = await Promise.all([
    ctx.get("analytics/diagnostics?days=30"),
    ctx.get("cash/register"),
    ctx.get("payments/settings"),
    ctx.get("sales/sales?offset=0"),
  ]);
  const totals = Object.entries(report.salesByAsset);
  return [
    heading(
      "Resumen",
      "Panel del comercio",
      "Ventas, efectivo y alertas de inventario.",
    ),
    el(
      "div",
      { class: "status-strip" },
      updated(report),
      ...paymentProfiles(payments),
    ),
    el(
      "div",
      { class: "cards" },
      metricCard(
        "Ventas completadas",
        totals.reduce((count, [, row]) => count + row.count, 0),
        "sales",
        "Últimos 30 días",
        "success",
      ),
      metricCard(
        "Efectivo esperado",
        register.session ? money(register.session.expectedBase, "COP") : "—",
        "cash",
        register.session ? "Caja abierta" : "Caja cerrada",
      ),
      metricCard(
        "Ventas pendientes",
        report.pendingSales.length,
        "clock",
        "En el corte analítico",
      ),
      metricCard(
        "Stock bajo mínimo",
        report.lowStock.length,
        "alert",
        "Productos en el corte",
        "warning",
      ),
    ),
    el(
      "div",
      { class: "split split-emphasis" },
      panel(
        "Ventas por activo",
        totals.length
          ? el(
              "dl",
              { class: "amount-list" },
              totals.map(([asset, row]) =>
                el(
                  "div",
                  {},
                  el("dt", {}, assetLabel(asset)),
                  el("dd", {}, money(row.amountBase, asset)),
                ),
              ),
            )
          : empty("Aún no hay ventas completadas en el periodo."),
      ),
      panel(
        "Alertas de inventario",
        report.lowStock.length
          ? table(
              ["SKU", "Disponible", "Mínimo"],
              report.lowStock
                .slice(0, 5)
                .map((p) => [p.sku, p.available, p.minimum]),
            )
          : empty("Sin productos bajo el mínimo."),
        el(
          "div",
          { class: "actions" },
          el("a", { href: adminUrl("diagnostics") }, "Ver diagnóstico"),
        ),
      ),
    ),
    panel(
      "Ventas recientes",
      recent.length
        ? table(
            ["Venta", "Estado", "Monto", "Fecha", "Acción"],
            recent
              .slice(0, 5)
              .map((sale) => [
                short(sale.id),
                pill(sale.status),
                money(sale.totalBase, sale.asset, sale.scale),
                date(sale.createdAt),
                el("a", { href: adminUrl("sales", sale.id) }, "Abrir venta"),
              ]),
          )
        : empty("Aún no hay ventas registradas."),
      el(
        "div",
        { class: "actions" },
        el("a", { href: adminUrl("sales") }, "Ver historial de ventas"),
      ),
    ),
    report.pendingSales.length
      ? panel(
          "Operaciones pendientes",
          table(
            ["Venta", "Estado", "Monto", "Acción"],
            report.pendingSales.map((sale) => [
              short(sale.id),
              pill(sale.status),
              money(sale.totalBase, sale.asset),
              el("a", { href: adminUrl("sales", sale.id) }, "Abrir venta"),
            ]),
          ),
        )
      : null,
    button("Reconciliar datos", () => ctx.action("analytics/reconcile")),
  ];
}
export async function diagnostics(ctx) {
  const data = await ctx.get(
    `analytics/diagnostics?days=${ctx.state.days ?? 30}`,
  );
  return [
    heading(
      "Diagnósticos",
      "Análisis",
      "Consulta ventas, caja, existencias y órdenes del corte.",
    ),
    updated(data),
    controls(ctx),
    panel(
      "Productos bajo mínimo",
      table(
        ["SKU", "Disponible", "Mínimo"],
        data.lowStock.map((p) => [p.sku, p.available, p.minimum]),
      ),
    ),
    panel(
      "Productos sin movimiento",
      data.sufficient.matureProducts
        ? table(
            ["SKU", "Último movimiento"],
            data.dormant.map((p) => [p.sku, date(p.lastMovement)]),
          )
        : empty("Sin productos con la antigüedad requerida."),
    ),
    panel(
      "Ventas por activo",
      table(
        ["Activo", "Ventas", "Monto"],
        Object.entries(data.salesByAsset).map(([asset, s]) => [
          asset,
          s.count,
          money(s.amountBase, asset),
        ]),
      ),
    ),
    panel(
      "Ventas pendientes",
      table(
        ["Venta", "Estado", "Monto"],
        data.pendingSales.map((s) => [
          short(s.id),
          pill(s.status),
          money(s.totalBase, s.asset),
        ]),
      ),
    ),
    panel(
      "Diferencias de caja",
      table(
        ["Sesión", "Cierre", "Diferencia"],
        data.cashDifferences.map((c) => [
          short(c.id),
          date(c.closedAt),
          money(c.differenceBase, "COP"),
        ]),
      ),
    ),
    panel(
      "Pagos rechazados o expirados",
      table(
        ["Orden", "Estado", "Código", "Fecha"],
        data.paymentFailures.map((p) => [
          el("a", { href: adminUrl("payments", p.id) }, short(p.id)),
          pill(p.status),
          p.failureCode,
          date(p.updatedAt),
        ]),
      ),
    ),
  ];
}
export async function simulation(ctx) {
  const products = await ctx.get(
    `inventory/products?search=${encodeURIComponent(ctx.state.search ?? "")}`,
  );
  const data = ctx.state.simulation;
  return [
    heading("Simulaciones", "Escenarios"),
    callout("El escenario no modifica las operaciones del comercio."),
    panel(
      "Supuestos del escenario",
      el(
        "p",
        { class: "note" },
        "Un punto base equivale a 0,01 %. El escenario usa el corte analítico y no modifica operaciones.",
      ),
      form(
        "Buscar producto",
        [
          [
            "search",
            "SKU o descripción",
            { required: false, value: ctx.state.search },
          ],
        ],
        ({ search }) => ctx.go({ search }),
      ),
      products.length
        ? form(
            "Calcular escenario",
            [
              [
                "productId",
                "Producto",
                productChoice(products, ctx.state.productId),
              ],
              [
                "baselineDays",
                "Días de ventas históricas",
                { type: "number", min: 1, max: 365, value: 30 },
              ],
              [
                "horizonDays",
                "Días del escenario",
                { type: "number", min: 1, max: 365, value: 30 },
              ],
              [
                "priceBasisPoints",
                "Cambio de precio (puntos base)",
                {
                  type: "number",
                  min: -10000,
                  max: 100000,
                  value: 0,
                  help: "Ejemplo: 1000 equivale a un aumento del 10 %.",
                },
              ],
              [
                "demandBasisPoints",
                "Cambio de demanda (puntos base)",
                {
                  type: "number",
                  min: -10000,
                  max: 100000,
                  value: 0,
                  help: "Ejemplo: −2000 equivale a una disminución del 20 %.",
                },
              ],
            ],
            async ({ productId, ...values }) => {
              const simulation = await ctx.post("analytics/simulate", {
                productId,
                ...Object.fromEntries(
                  Object.entries(values).map(([k, v]) => [k, Number(v)]),
                ),
              });
              ctx.go({ simulation, productId });
            },
          )
        : empty("Crea un producto para simular."),
    ),
    data
      ? panel(
          `Resultado · ${data.sku}`,
          updated(data),
          el("p", {}, data.calculation),
          el(
            "p",
            { class: "note" },
            `Base de ${data.assumptions.baselineDays} días · horizonte de ${data.assumptions.horizonDays} días · precio ${data.assumptions.priceBasisPoints} pb · demanda ${data.assumptions.demandBasisPoints} pb`,
          ),
          el(
            "p",
            { class: "note" },
            `Corte base: ${data.baseline.sales} ventas, ${data.baseline.units} unidades vendidas, ${data.baseline.available} disponibles y mínimo de ${data.baseline.minimum}.`,
          ),
          data.sufficient
            ? table(
                [
                  "Precio del escenario",
                  "Unidades",
                  "Ingreso del escenario",
                  "Reposición",
                ],
                [
                  [
                    money(data.projectedPriceBase, data.asset, data.scale),
                    data.projectedUnits,
                    money(data.projectedRevenueBase, data.asset, data.scale),
                    data.reorderUnits,
                  ],
                ],
              )
            : empty(
                "Sin ventas históricas suficientes para estimar unidades o reposición.",
              ),
        )
      : null,
  ];
}
export async function recommendations(ctx) {
  const data = await ctx.get(
    `analytics/recommendations?days=${ctx.state.days ?? 30}`,
  );
  return [
    heading(
      "Recomendaciones",
      "Análisis",
      "Consulta reglas, umbrales y evidencia del corte.",
    ),
    updated(data),
    controls(ctx),
    ...data.rules.map((rule) =>
      panel(
        rule.action,
        el("p", {}, rule.rule),
        el("p", { class: "note" }, `Umbral ${rule.threshold} · ${rule.period}`),
        !rule.sufficient
          ? empty("Datos insuficientes para aplicar la regla.")
          : !rule.findings.length
            ? empty("Sin hallazgos para este corte.")
            : el(
                "ul",
                {},
                rule.findings.map((value) =>
                  el(
                    "li",
                    {},
                    value.sku
                      ? `${value.sku} · ${value.minimum === undefined ? `último movimiento ${date(value.lastMovement)}` : `disponible ${value.available} · mínimo ${value.minimum}`}`
                      : value.code
                        ? `${value.code} · ${value.count} órdenes (${value.orders.map(short).join(", ")})`
                        : `Sesión ${short(value.id)} · ${date(value.closedAt)} · ${money(value.differenceBase, "COP")}`,
                  ),
                ),
              ),
      ),
    ),
  ];
}
