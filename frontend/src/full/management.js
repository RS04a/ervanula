import {
  button,
  date,
  el,
  empty,
  form,
  heading,
  id,
  listFilter,
  pager,
  panel,
  pill,
  short,
  table,
} from "./ui.js";

export async function settings(ctx) {
  const { get, go, state, admin, action } = ctx;
  const merchant = await get("merchant/profile");
  const users = admin ? await get(`identity/users?offset=${state.page}`) : [];
  return [
    heading("Configuración", merchant.name),
    panel(
      "Perfil del comercio",
      el("p", {}, merchant.name),
      admin
        ? form(
            "Guardar perfil",
            [
              [
                "name",
                "Nombre del comercio",
                { value: merchant.name, maxlength: 120 },
              ],
            ],
            async (data) => {
              await ctx.post("merchant/profile", data);
              await ctx.refreshIdentity();
              go({});
            },
          )
        : null,
    ),
    panel(
      "Billeteras receptoras",
      table(
        ["Red", "Activo", "Dirección"],
        merchant.wallets.map((w) => [w.network, w.asset, w.address]),
      ),
      admin
        ? form(
            "Guardar billetera",
            [
              [
                "network",
                "Red TRON",
                { choices: ["mainnet", "nile", "shasta"] },
              ],
              ["asset", "Activo", { choices: ["USDT", "ARVE"] }],
              ["address", "Dirección pública", { maxlength: 64 }],
            ],
            async (data) => {
              if (
                !window.confirm("¿Guardar esta dirección para futuras órdenes?")
              )
                return;
              await ctx.post("merchant/wallets", data);
              go({});
            },
          )
        : null,
    ),
    admin
      ? panel(
          "Usuarios",
          form(
            "Crear usuario",
            [
              ["email", "Correo", { type: "email", maxlength: 120 }],
              ["displayName", "Nombre", { maxlength: 120 }],
              [
                "password",
                "Contraseña",
                {
                  type: "password",
                  minlength: 12,
                  maxlength: 128,
                  autocomplete: "new-password",
                },
              ],
              ["role", "Rol", { choices: ["CASHIER", "ADMIN"] }],
            ],
            async (data) => {
              await ctx.post("identity/users", data);
              go({});
            },
          ),
          table(
            ["Usuario", "Correo", "Rol", "Estado", "Acción"],
            users.map((u) => [
              u.displayName,
              u.email,
              pill(u.role),
              u.active ? "Activo" : "Inactivo",
              u.active && u.userId !== ctx.userId
                ? button("Desactivar", () =>
                    action(
                      `identity/users/${u.userId}/deactivate`,
                      {},
                      "¿Revocar el acceso del usuario?",
                    ),
                  )
                : null,
            ]),
          ),
          pager(state.page, users, (page) => go({ page })),
        )
      : null,
  ];
}
export async function imports(ctx) {
  const { get, state, go, action } = ctx;
  const [jobs, job] = await Promise.all([
    get(
      `imports/jobs?offset=${state.page}&status=${encodeURIComponent(state.status ?? "")}`,
    ),
    state.selected
      ? get(`imports/jobs/${state.selected}?offset=${state.secondPage ?? 0}`)
      : null,
  ]);
  if (job?.status === "RUNNING") ctx.poll();
  const reference = id();
  return [
    heading("Importar productos", "CSV"),
    panel(
      "Cargar archivo",
      el(
        "p",
        { class: "note" },
        "UTF-8 · hasta 250 filas y 60 kB. Los SKU existentes se rechazan; las existencias iniciales se registran como entradas.",
      ),
      button("Descargar plantilla", () =>
        ctx.task(async () => {
          const template = await get("imports/template");
          const link = URL.createObjectURL(
            new Blob([template.content], { type: "text/csv;charset=utf-8" }),
          );
          el("a", { href: link, download: template.filename }).click();
          window.setTimeout(() => URL.revokeObjectURL(link), 1000);
        }),
      ),
      form(
        "Ver vista previa",
        [["file", "Archivo CSV", { type: "file", accept: ".csv,text/csv" }]],
        async ({ file }) => {
          if (!file.size || file.size > 60000)
            throw new Error("Selecciona un CSV de hasta 60 kB");
          const bytes = new Uint8Array(await file.arrayBuffer());
          const csv = btoa(
            Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
          );
          const preview = await ctx.post("imports/jobs", {
            id: reference,
            csv,
          });
          window.location.hash = `imports/${preview.id}`;
        },
      ),
    ),
    job
      ? panel(
          "Detalle de importación",
          el(
            "div",
            { class: "actions" },
            pill(job.status),
            button("Actualizar importación", () => go({})),
            job.status === "PREVIEW"
              ? button(
                  "Confirmar importación",
                  () =>
                    action(
                      `imports/jobs/${job.id}/confirm`,
                      {},
                      "¿Aplicar las filas válidas al inventario?",
                    ),
                  true,
                )
              : null,
          ),
          job.status === "DONE" && job.progress.FAILED
            ? button("Reintentar fallos temporales", () =>
                action(`imports/jobs/${job.id}/retry`),
              )
            : null,
          el(
            "p",
            { class: "note" },
            Object.entries(job.progress)
              .map(([key, value]) => `${key} ${value}`)
              .join(" · "),
          ),
          table(
            ["Fila", "SKU", "Catálogo", "Entrada inicial", "Estado", "Error"],
            job.rows.map((r) => [
              r.rowNumber,
              r.sku,
              r.product
                ? `${r.product.description} · ${r.product.price} ${r.product.asset}`
                : null,
              r.product?.quantity,
              pill(r.status),
              r.error,
            ]),
          ),
          pager(state.secondPage ?? 0, job.rows, (secondPage) =>
            go({ secondPage }),
          ),
        )
      : null,
    panel(
      "Historial de importaciones",
      listFilter(
        "Filtrar trabajos",
        "status",
        "Estado de importación",
        ["PREVIEW", "RUNNING", "DONE"],
        state.status,
        (status) => go({ status, page: 0 }),
      ),
      jobs.length
        ? table(
            ["Trabajo", "Fecha", "Estado", "Acción"],
            jobs.map((j) => [
              short(j.id),
              date(j.createdAt),
              pill(j.status),
              el("a", { href: `#imports/${j.id}` }, "Abrir importación"),
            ]),
          )
        : empty(),
      pager(state.page, jobs, (page) => go({ page })),
    ),
  ];
}
