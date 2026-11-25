import { adminUrl } from "./routes.js";
import {
  assets,
  button,
  date,
  el,
  empty,
  form,
  heading,
  id,
  money,
  listFilter,
  pager,
  panel,
  pill,
  short,
  table,
  split,
  paymentProfiles,
  networkName,
  detailList,
  callout,
} from "./ui.js";

const count = (value = 0) => ({
  type: "number",
  min: 0,
  max: 1000000,
  step: 1,
  value,
});
const amount = (value) => ({
  inputmode: "decimal",
  pattern: "[0-9]+([.][0-9]{1,6})?",
  value,
});
const text = (value) => ({ value, maxlength: 120 });
const endpoint = (path, page) =>
  `${path}${path.includes("?") ? "&" : "?"}offset=${page}`;
export const productChoice = (products, current) => ({
  choices: products.map((p) => [p.id, `${p.sku} · ${p.description}`]),
  value: current,
});
function productFields(product) {
  return [
    ["sku", "SKU", text(product?.sku)],
    ["description", "Descripción", text(product?.description)],
    ["asset", "Activo", { choices: assets, value: product?.asset }],
    [
      "price",
      "Precio unitario",
      amount(
        product
          ? money(product.priceBase, product.asset, product.scale).split(" ")[0]
          : "",
      ),
    ],
    ["minimum", "Mínimo de existencias", count(product?.minimum)],
  ];
}
export async function products(ctx) {
  const { get, action, state, go, admin } = ctx;
  const search = state.search ?? "";
  const rows = await get(
    endpoint(
      `inventory/products?search=${encodeURIComponent(search)}`,
      state.page,
    ),
  );
  const edit = state.selected
    ? rows.find((p) => p.id === state.selected)
    : null;
  return [
    heading(
      "Productos",
      "Inventario",
      "Administra el catálogo y revisa el stock por producto.",
    ),
    admin
      ? panel(
          edit ? `Editar ${edit.sku}` : "Nuevo producto",
          form(
            edit ? "Guardar cambios" : "Crear producto",
            productFields(edit),
            async (data) => {
              await ctx.post(
                edit
                  ? `inventory/products/${edit.id}/edit`
                  : "inventory/products",
                { ...data, minimum: Number(data.minimum) },
              );
              go({ selected: null });
            },
          ),
          edit ? button("Cerrar edición", () => go({ selected: null })) : null,
        )
      : null,
    panel(
      "Catálogo",
      form(
        "Buscar",
        [["search", "SKU o descripción", { required: false, value: search }]],
        (data) => go({ search: data.search, page: 0, selected: null }),
      ),
      table(
        [
          "SKU",
          "Descripción",
          "Precio",
          "Disponible",
          "Mínimo",
          "Estado",
          ...(admin ? ["Acciones"] : []),
        ],
        rows.map((p) => [
          p.sku,
          p.description,
          money(p.priceBase, p.asset, p.scale),
          p.balance?.available ?? 0,
          p.minimum,
          pill(p.active ? "Activo" : "Inactivo"),
          ...(admin
            ? [
                el(
                  "div",
                  { class: "actions" },
                  button("Editar", () => go({ selected: p.id }, true)),
                  p.active
                    ? button("Desactivar", () =>
                        action(
                          `inventory/products/${p.id}/deactivate`,
                          {},
                          "¿Desactivar este producto?",
                        ),
                      )
                    : null,
                ),
              ]
            : []),
        ]),
      ),
      pager(state.page, rows, (page) => go({ page, selected: null })),
    ),
  ];
}
export async function inventory(ctx) {
  const { get, state, go, admin } = ctx;
  const filter = state.filter
    ? `?productId=${encodeURIComponent(state.filter)}`
    : "";
  const [rows, products] = await Promise.all([
    get(endpoint(`inventory/movements${filter}`, state.page)),
    get(
      endpoint(
        `inventory/products?search=${encodeURIComponent(state.stockSearch ?? "")}`,
        state.stockPage ?? 0,
      ),
    ),
  ]);
  return [
    heading(
      "Inventario",
      "Operaciones",
      "Consulta existencias, reservas y movimientos.",
    ),
    split(
      panel(
        "Saldos",
        form(
          "Buscar saldo",
          [
            [
              "stockSearch",
              "SKU o descripción",
              { value: state.stockSearch, required: false },
            ],
          ],
          ({ stockSearch }) => go({ stockSearch, stockPage: 0 }),
        ),
        table(
          ["SKU", "Disponible", "Reservado", "Historial"],
          products.map((p) => [
            p.sku,
            p.balance?.available ?? 0,
            p.balance?.reserved ?? 0,
            button("Filtrar", () => go({ filter: p.id, page: 0 })),
          ]),
        ),
        pager(state.stockPage ?? 0, products, (stockPage) => go({ stockPage })),
      ),
      admin && products.some((p) => p.active)
        ? panel(
            "Registrar movimiento",
            form(
              "Registrar",
              [
                [
                  "productId",
                  "Producto",
                  productChoice(products.filter((p) => p.active)),
                ],
                [
                  "kind",
                  "Tipo",
                  {
                    choices: [
                      ["IN", "Entrada"],
                      ["OUT", "Salida"],
                      ["ADJUST", "Ajuste por diferencia"],
                    ],
                  },
                ],
                [
                  "quantity",
                  "Unidades (con signo para ajuste)",
                  { ...count(), min: -1000000 },
                ],
                ["reason", "Motivo", text()],
              ],
              ctx.referenced("inventory/movements", (data) => ({
                ...data,
                quantity: Number(data.quantity),
              })),
            ),
          )
        : null,
    ),
    panel(
      "Movimientos",
      state.filter
        ? button("Quitar filtro", () => go({ filter: null, page: 0 }))
        : null,
      table(
        ["Fecha", "Producto", "Tipo", "Unidades", "Motivo", "Usuario"],
        rows.map((m) => [
          date(m.createdAt),
          products.find((p) => p.id === m.productId)?.sku ?? short(m.productId),
          m.kind,
          m.quantity,
          m.reason,
          short(m.userId),
        ]),
      ),
      pager(state.page, rows, (page) => go({ page })),
    ),
  ];
}
export async function sales(ctx) {
  const { get, go, state, action } = ctx;
  const [rows, selected] = await Promise.all([
    get(
      endpoint(
        `sales/sales?status=${encodeURIComponent(state.status ?? "")}`,
        state.page,
      ),
    ),
    state.selected ? get(`sales/sales/${state.selected}`) : null,
  ]);
  const renderDetail = async (sale) => {
    if (!sale) return null;
    const draft = sale.status === "DRAFT";
    const all = draft
      ? await get(
          `inventory/products?search=${encodeURIComponent(state.productSearch ?? "")}`,
        )
      : [];
    const available = all.filter((p) => p.active && p.asset === sale.asset);
    if (!["DRAFT", "COMPLETED", "CANCELLED", "REVIEW"].includes(sale.status))
      ctx.poll();
    return panel(
      `Venta ${short(sale.id)}`,
      el(
        "div",
        { class: "actions" },
        pill(sale.status),
        el("strong", {}, money(sale.totalBase, sale.asset, sale.scale)),
        sale.paymentId
          ? el(
              "a",
              { href: adminUrl("payments", sale.paymentId) },
              "Ver orden de pago",
            )
          : null,
        button("Actualizar venta", () => go({})),
      ),
      sale.exception ? el("p", { class: "error" }, sale.exception) : null,
      table(
        [
          "SKU",
          "Descripción",
          "Precio",
          "Cantidad",
          ...(draft ? ["Acción"] : []),
        ],
        sale.items.map((item) => [
          item.sku,
          item.description,
          money(item.priceBase, sale.asset, item.scale),
          item.quantity,
          ...(draft
            ? [
                button("Quitar", () =>
                  action(`sales/sales/${sale.id}/items`, {
                    productId: item.productId,
                    quantity: 0,
                  }),
                ),
              ]
            : []),
        ]),
      ),
      draft
        ? form(
            "Buscar artículos",
            [
              [
                "productSearch",
                "SKU o descripción",
                { value: state.productSearch, required: false },
              ],
            ],
            ({ productSearch }) => go({ productSearch }),
          )
        : null,
      draft && available.length
        ? form(
            "Guardar artículo",
            [
              ["productId", "Producto", productChoice(available)],
              ["quantity", "Cantidad", { ...count(1), min: 1 }],
            ],
            async (data) => {
              await ctx.post(`sales/sales/${sale.id}/items`, {
                productId: data.productId,
                quantity: Number(data.quantity),
              });
              go({});
            },
          )
        : draft
          ? empty(`No hay productos activos de ${sale.asset} en esta búsqueda.`)
          : null,
      draft
        ? el(
            "div",
            { class: "actions" },
            sale.items.length
              ? button(
                  "Iniciar checkout",
                  () =>
                    action(
                      `sales/sales/${sale.id}/checkout`,
                      {},
                      sale.asset === "COP"
                        ? "¿Registrar este cobro en efectivo?"
                        : "¿Reservar artículos y crear orden?",
                    ),
                  true,
                )
              : null,
            button("Cancelar borrador", () =>
              action(
                `sales/sales/${sale.id}/cancel`,
                {},
                "¿Cancelar el borrador?",
              ),
            ),
          )
        : null,
    );
  };
  const draftId = id();
  return [
    heading(
      "Ventas",
      "Operaciones",
      "Crea una venta en COP, USDT o ARVE y consulta su estado.",
    ),
    split(
      panel(
        "Nueva venta",
        form(
          "Crear borrador",
          [["asset", "Activo de la venta", { choices: assets }]],
          async (data) => {
            const sale = await ctx.post("sales/sales", {
              asset: data.asset,
              id: draftId,
            });
            ctx.navigate(adminUrl("sales", sale.id));
          },
        ),
      ),
      await renderDetail(selected),
    ),
    panel(
      "Historial",
      listFilter(
        "Filtrar ventas",
        "status",
        "Estado de venta",
        ["DRAFT", "AWAITING_PAYMENT", "COMPLETED", "CANCELLED", "REVIEW"],
        state.status,
        (status) => go({ status, page: 0 }),
      ),
      table(
        ["Venta", "Total", "Estado", "Fecha", "Acción"],
        rows.map((sale) => [
          short(sale.id),
          money(sale.totalBase, sale.asset, sale.scale),
          pill(sale.status),
          date(sale.createdAt),
          el("a", { href: adminUrl("sales", sale.id) }, "Abrir venta"),
        ]),
      ),
      pager(state.page, rows, (page) => go({ page })),
    ),
  ];
}
export async function cash(ctx) {
  const { get, state, go, admin } = ctx;
  const [register, sessions, movements] = await Promise.all([
    get("cash/register"),
    get(endpoint("cash/sessions", state.page)),
    get(
      endpoint(
        `cash/movements?asset=${encodeURIComponent(state.asset ?? "")}`,
        state.secondPage ?? 0,
      ),
    ),
  ]);
  const current = register.session;
  return [
    heading(
      "Caja",
      register.name,
      "Controla la sesión física y consulta los movimientos por activo.",
    ),
    callout(
      "Los cobros digitales en USDT o ARVE no cambian el efectivo físico en COP.",
    ),
    split(
      current
        ? panel(
            "Caja abierta",
            el("p", { class: "metric" }, money(current.expectedBase, "COP")),
            el(
              "p",
              { class: "note" },
              `Efectivo esperado · apertura ${date(current.openedAt)}`,
            ),
            form(
              "Cerrar caja",
              [["amount", "Efectivo contado (COP)", amount()]],
              ctx.referenced(
                "cash/close",
                (data) => ({ ...data, sessionId: current.id }),
                "¿Cerrar la sesión de caja?",
              ),
            ),
          )
        : panel(
            "Caja cerrada",
            form(
              "Abrir caja",
              [["amount", "Saldo inicial (COP)", amount("0")]],
              ctx.referenced("cash/open"),
            ),
          ),
      current && admin
        ? panel(
            "Movimiento manual",
            form(
              "Registrar movimiento",
              [
                [
                  "kind",
                  "Tipo",
                  {
                    choices: [
                      ["IN", "Ingreso"],
                      ["OUT", "Egreso"],
                    ],
                  },
                ],
                ["amount", "Monto (COP)", amount()],
                ["reason", "Motivo", text()],
              ],
              ctx.referenced("cash/movements", (data) => ({
                ...data,
                sessionId: current.id,
              })),
            ),
          )
        : null,
    ),
    panel(
      "Sesiones",
      table(
        ["Apertura", "Cierre", "Inicial", "Esperado", "Contado", "Diferencia"],
        sessions.map((s) => [
          date(s.openedAt),
          date(s.closedAt),
          ...[
            s.openingBase,
            s.expectedBase,
            s.countedBase,
            s.differenceBase,
          ].map((v) => money(v, "COP")),
        ]),
      ),
      pager(state.page, sessions, (page) => go({ page })),
    ),
    panel(
      "Movimientos físicos y digitales",
      listFilter(
        "Filtrar movimientos",
        "asset",
        "Activo del movimiento",
        assets,
        state.asset,
        (asset) => go({ asset, secondPage: 0 }),
      ),
      table(
        ["Fecha", "Tipo", "Ámbito", "Monto", "Venta", "Sesión", "Motivo"],
        movements.map((m) => [
          date(m.createdAt),
          m.kind,
          pill(
            m.asset === "COP" ? "Efectivo" : "Digital",
            m.asset === "COP" ? "success" : "blue",
          ),
          money(m.amountBase, m.asset),
          short(m.saleId),
          short(m.sessionId),
          m.reason,
        ]),
      ),
      pager(state.secondPage ?? 0, movements, (secondPage) =>
        go({ secondPage }),
      ),
    ),
  ];
}
export async function payments(ctx) {
  const { get, state, go } = ctx;
  const [settings, orders, order, audit] = await Promise.all([
    get("payments/settings"),
    get(
      endpoint(
        `payments/orders?status=${encodeURIComponent(state.status ?? "")}`,
        state.page,
      ),
    ),
    state.selected ? get(`payments/orders/${state.selected}`) : null,
    state.selected ? get(`payments/orders/${state.selected}/audit`) : [],
  ]);
  return [
    heading(
      "Pagos",
      "Operaciones",
      "Consulta y verifica las órdenes TRC-20 de cada venta.",
    ),
    el("div", { class: "status-strip" }, ...paymentProfiles(settings)),
    settings.network !== "mainnet" ||
    (settings.arve && settings.arve.network !== "mainnet")
      ? callout(
          "Las órdenes marcadas TESTNET corresponden a redes de prueba.",
          true,
        )
      : null,
    order
      ? panel(
          "Orden de pago",
          el(
            "div",
            { class: "actions" },
            pill(order.status),
            el(
              "strong",
              {},
              money(
                order.amountBaseUnits,
                order.tokenSymbol,
                order.tokenDecimals,
              ),
            ),
            button("Actualizar orden", () => go({})),
          ),
          detailList([
            ["Red", networkName(order.network)],
            ["Vencimiento", date(order.expiresAt)],
            ["Contrato", order.tokenContract],
            ["Dirección receptora", order.recipientAddress],
            ...(order.transactionHash
              ? [["Hash registrado", order.transactionHash]]
              : []),
          ]),
          button("Copiar dirección", () =>
            ctx.task(() =>
              navigator.clipboard.writeText(order.recipientAddress),
            ),
          ),
          order.confirmedAt && order.status !== "CONFIRMED"
            ? el(
                "p",
                { class: "error" },
                "Transferencia tardía registrada para revisión.",
              )
            : null,
          (order.tokenSymbol === "ARVE"
            ? settings.arve?.provider
            : settings.provider) === "simulated"
            ? el(
                "p",
                { class: "note" },
                `Demo de 10 ${order.tokenSymbol} hacia la dirección de prueba. Ejemplo: demo:valid:defensa-01.`,
              )
            : null,
          order.status !== "CONFIRMED"
            ? form(
                "Verificar transacción",
                [
                  [
                    "transactionHash",
                    "Hash de transacción",
                    { maxlength: 100 },
                  ],
                ],
                async (data) => {
                  await ctx.post(`payments/orders/${order.id}/verify`, data);
                  go({});
                },
              )
            : null,
          el("h3", { class: "audit-heading" }, "Auditoría"),
          table(
            ["Fecha", "Evento", "Estado", "Código"],
            audit.map((a) => [
              date(a.createdAt),
              a.eventType,
              a.newStatus,
              a.failureCode,
            ]),
          ),
        )
      : null,
    panel(
      "Órdenes",
      listFilter(
        "Filtrar órdenes",
        "status",
        "Estado de orden",
        ["PENDING", "CONFIRMING", "CONFIRMED", "REJECTED", "EXPIRED"],
        state.status,
        (status) => go({ status, page: 0 }),
      ),
      table(
        ["Fecha", "Venta", "Monto", "Estado", "Acción"],
        orders.map((o) => [
          date(o.createdAt),
          short(o.saleId),
          money(o.amountBaseUnits, o.tokenSymbol, o.tokenDecimals),
          pill(o.status),
          el("a", { href: adminUrl("payments", o.id) }, "Abrir orden"),
        ]),
      ),
      pager(state.page, orders, (page) => go({ page })),
    ),
  ];
}
