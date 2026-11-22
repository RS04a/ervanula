import { api } from "./api.js";
import { button, el, form, heading, id, panel } from "./ui.js";
import { cash, inventory, payments, products, sales } from "./operations.js";
import { imports, settings } from "./management.js";
import {
  dashboard,
  diagnostics,
  recommendations,
  simulation,
} from "./analytics.js";

const main = document.querySelector("#content");
const nav = document.querySelector("#navigation");
const account = document.querySelector("#identity");
const views = {
  dashboard: ["Dashboard", dashboard],
  sales: ["Ventas", sales],
  products: ["Productos", products],
  inventory: ["Inventario", inventory],
  cash: ["Caja", cash],
  payments: ["Pagos", payments],
  imports: ["Importación", imports, true],
  diagnostics: ["Diagnósticos", diagnostics],
  simulation: ["Simulaciones", simulation],
  recommendations: ["Recomendaciones", recommendations],
  settings: ["Configuración", settings],
};
let user;
let merchant;
let state = { page: 0 };
let controller;
let timer;
let active = "dashboard";
let activeTask = false;
const notice = el("p", { role: "status", class: "feedback" });

async function task(work, refresh = false) {
  if (activeTask) return;
  activeTask = true;
  notice.className = "feedback";
  notice.textContent = "Procesando…";
  try {
    await work();
    notice.textContent = "Operación registrada.";
    if (refresh) void render();
  } catch (error) {
    notice.className = "feedback error";
    notice.textContent = `${error.message}${error.retryable ? " · Puedes reintentar." : ""}`;
    if (error.status === 401) login();
  } finally {
    activeTask = false;
  }
}
function login() {
  user = null;
  controller?.abort();
  window.clearTimeout(timer);
  nav.hidden = true;
  nav.replaceChildren();
  account.replaceChildren();
  main.setAttribute("aria-busy", "false");
  main.replaceChildren(
    heading("Iniciar sesión", "Acceso al comercio"),
    panel(
      "Credenciales",
      form(
        "Entrar",
        [
          [
            "email",
            "Correo",
            { type: "email", autocomplete: "username", maxlength: 120 },
          ],
          [
            "password",
            "Contraseña",
            {
              type: "password",
              autocomplete: "current-password",
              maxlength: 128,
            },
          ],
        ],
        async (input) => {
          await api("identity/login", input);
          await refreshIdentity();
          await render(true);
        },
      ),
    ),
  );
}
async function refreshIdentity() {
  [user, merchant] = await Promise.all([
    api("identity/session"),
    api("merchant/profile"),
  ]);
  account.replaceChildren(
    el("span", {}, `${merchant.name} · ${user.displayName} · ${user.role}`),
    button("Salir", () =>
      task(async () => {
        await api("identity/logout", {});
        login();
      }),
    ),
  );
}
function identifyRoute() {
  const [key, selected] = window.location.hash.slice(1).split("/");
  const view = Object.hasOwn(views, key) ? key : "dashboard";
  return { view, selected: /^[\w-]+$/.test(selected ?? "") ? selected : null };
}
async function render(focus = false, background = false) {
  if (!user) return;
  window.clearTimeout(timer);
  controller?.abort();
  controller = new window.AbortController();
  const signal = controller.signal;
  const { view, selected } = identifyRoute();
  const admin = user.role === "ADMIN";
  if (view !== active || selected !== (state.selectedRoute ?? null))
    state = { page: 0, selected, selectedRoute: selected };
  active = view;
  nav.hidden = false;
  nav.replaceChildren(
    ...Object.entries(views)
      .filter(([, [, , restricted]]) => !restricted || admin)
      .map(([key, [name]]) =>
        el(
          "a",
          { href: `#${key}`, "aria-current": key === view ? "page" : null },
          name,
        ),
      ),
  );
  const go = (patch, nextFocus = false) => {
    state = { ...state, ...patch };
    void render(nextFocus);
  };
  const post = (path, body) => api(path, body);
  let polling = false;
  const ctx = {
    admin,
    userId: user.userId,
    state,
    go,
    get: (path) => api(path, undefined, signal),
    post,
    refreshIdentity,
    task,
    poll: () => {
      polling = true;
    },
    action: (path, body = {}, message) => {
      if (!message || window.confirm(message))
        return task(() => post(path, body), true);
    },
    referenced: (path, map = (data) => data, message) => {
      let reference = id();
      return async (data) => {
        if (message && !window.confirm(message)) return;
        await post(path, { ...map(data), reference });
        reference = id();
        go({});
      };
    },
  };
  if (!background) {
    main.setAttribute("aria-busy", "true");
    main.replaceChildren(el("p", { role: "status" }, "Cargando…"), notice);
  }
  try {
    const [name, load, restricted] = views[view];
    const content =
      restricted && !admin
        ? [heading(name), el("p", { role: "alert" }, "Se requiere rol ADMIN.")]
        : await load(ctx);
    if (signal.aborted) return;
    main.replaceChildren(...content.filter(Boolean), notice);
    if (focus) main.focus();
    if (polling)
      timer = window.setTimeout(() => {
        if (!signal.aborted) void render(false, true);
      }, 2800);
  } catch (error) {
    if (signal.aborted) return;
    if (error.status === 401) return login();
    main.replaceChildren(
      heading(views[view][0]),
      el("p", { role: "alert", class: "error" }, error.message),
      button("Reintentar", () => render()),
    );
  } finally {
    if (!signal.aborted) main.setAttribute("aria-busy", "false");
  }
}
window.addEventListener("hashchange", () => {
  notice.textContent = "";
  void render(true);
});
refreshIdentity().then(
  () => render(),
  (error) => {
    if (error.status === 401) login();
    else {
      main.setAttribute("aria-busy", "false");
      main.replaceChildren(
        heading("Servicio no disponible"),
        el("p", { role: "alert" }, error.message),
        button("Recargar", () => window.location.reload()),
      );
    }
  },
);
