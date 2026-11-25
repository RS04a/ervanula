import { adminUrl } from "./routes.js";
import {
  assetLabel,
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
  help: "Usa punto decimal y omite separadores de miles. Ejemplo: 2500.50.",
});
const movementLabels = {
  IN: "Entrada",
  OUT: "Salida",
  ADJUST: "Ajuste",
  SALE: "Venta",
};
const text = (value) => ({ value, maxlength: 120 });
const endpoint = (path, page) =>
  `${path}${path.includes("?") ? "&" : "?"}offset=${page}`;
export const productChoice = (products, current) => ({
  choices: products.map((p) => [p.id, `${p.sku} · ${p.description}`]),
  value: current,
});
function productFields(product) {
  return [
    [
      "sku",
      "SKU",
      {
        ...text(product?.sku),
        help: "Código único del producto. Ejemplo: CAFE-250.",
      },
    ],
    ["description", "Descripción", text(product?.description)],
    [
      "asset",
      "Activo",
      {
        choices: assets,
        value: product?.asset,
        help: "Moneda o token en que se vende el producto.",
      },
    ],
    [
      "price",
      "Precio unitario",
      amount(
        product
          ? money(product.priceBase, product.asset, product.scale).split(" ")[0]
          : "",
      ),
    ],
    [
      "minimum",
      "Mínimo de existencias",
      {
        ...count(product?.minimum),
        help: "Unidades que sirven de referencia para el diagnóstico de stock.",
      },
    ],
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
        [
          [
            "search",
            "SKU o descripción",
            {
              required: false,
              value: search,
              help: "Escribe parte del código o nombre. Vacío muestra todo el catálogo.",
            },
          ],
        ],
        (data) => go({ search: data.search, page: 0, selected: null }),
      ),
      table(
        [
          "SKU",
          "Descripción",
          "Precio",
          "Disponible",
          "Reservado",
          "Mínimo",
          "Estado",
          ...(admin ? ["Acciones"] : []),
        ],
        rows.map((p) => [
          p.sku,
          p.description,
          money(p.priceBase, p.asset, p.scale),
          p.balance?.available ?? 0,
          p.balance?.reserved ?? 0,
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
        search
          ? "No se encontraron productos para esta búsqueda."
          : "El catálogo todavía está vacío.",
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
        "Existencias por producto",
        el(
          "p",
          { class: "note" },
          "Disponible: puedes usarlo en una venta. Reservado: está asignado a un checkout pendiente.",
        ),
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
          [
            "SKU y descripción",
            "Disponible",
            "Reservado",
            "Mínimo",
            "Historial",
          ],
          products.map((p) => [
            el(
              "span",
              { class: "product-identity" },
              el("strong", {}, p.sku),
              el("span", {}, p.description),
            ),
            p.balance?.available ?? 0,
            p.balance?.reserved ?? 0,
            p.minimum,
            button("Ver movimientos", () =>
              go({ filter: p.id, filterSku: p.sku, page: 0 }),
            ),
          ]),
          "No hay productos para mostrar. Prueba otra búsqueda o abre Productos.",
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
                  {
                    ...count(),
                    min: -1000000,
                    help: "Usa un entero positivo para entradas y salidas. En un ajuste, −2 descuenta dos unidades.",
                  },
                ],
                [
                  "reason",
                  "Motivo",
                  {
                    ...text(),
                    help: "Ejemplos: reposición, avería o diferencia de conteo.",
                  },
                ],
              ],
              ctx.referenced(
                "inventory/movements",
                (data) => ({
                  ...data,
                  quantity: Number(data.quantity),
                }),
                "¿Registrar este movimiento y actualizar las existencias?",
              ),
            ),
          )
        : null,
    ),
    panel(
      "Movimientos",
      state.filter
        ? el(
            "div",
            { class: "actions" },
            el(
              "p",
              { class: "note" },
              `Movimientos de ${state.filterSku ?? short(state.filter)}`,
            ),
            button("Quitar filtro", () =>
              go({ filter: null, filterSku: null, page: 0 }),
            ),
          )
        : null,
      table(
        ["Fecha", "Producto", "Tipo", "Unidades", "Motivo", "Usuario"],
        rows.map((m) => [
          date(m.createdAt),
          products.find((p) => p.id === m.productId)?.sku ?? short(m.productId),
          movementLabels[m.kind] ?? m.kind,
          m.quantity,
          m.reason,
          short(m.userId),
        ]),
        "Aún no hay movimientos para el filtro actual.",
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
                  "Confirmar venta",
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
          [
            [
              "asset",
              "Activo de la venta",
              {
                choices: assets,
                help: "COP se cobra en efectivo con la caja abierta. ARVE y USDT crean una orden TRC-20.",
              },
            ],
          ],
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
              [
                [
                  "amount",
                  "Efectivo contado (COP)",
                  {
                    ...amount(),
                    help: "Cuenta los billetes y monedas. Ejemplo: 155.00. El sistema calcula la diferencia.",
                  },
                ],
              ],
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
              [
                [
                  "amount",
                  "Saldo inicial (COP)",
                  {
                    ...amount("0"),
                    help: "Anota el efectivo físico disponible antes de la primera venta.",
                  },
                ],
              ],
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
              ctx.referenced(
                "cash/movements",
                (data) => ({
                  ...data,
                  sessionId: current.id,
                }),
                "¿Registrar este ingreso o egreso de efectivo?",
              ),
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
        "Aún no se han abierto sesiones de caja.",
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
    el(
      "p",
      { class: "note" },
      "Simulación acepta referencias de demostración. TronGrid comprueba hashes públicos en la red indicada.",
    ),
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
              assetLabel(
                order.tokenSymbol,
                money(
                  order.amountBaseUnits,
                  order.tokenSymbol,
                  order.tokenDecimals,
                ),
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
            ctx.task(
              () => navigator.clipboard.writeText(order.recipientAddress),
              false,
              "Dirección copiada.",
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
                    {
                      maxlength: 100,
                      help: "Pega el identificador de la transacción de esta orden. En TronGrid se usan 64 caracteres hexadecimales.",
                    },
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
          assetLabel(
            o.tokenSymbol,
            money(o.amountBaseUnits, o.tokenSymbol, o.tokenDecimals),
          ),
          pill(o.status),
          el("a", { href: adminUrl("payments", o.id) }, "Abrir orden"),
        ]),
      ),
      pager(state.page, orders, (page) => go({ page })),
    ),
  ];
}
