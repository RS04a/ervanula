export function el(tag, attrs = {}, ...children) {
  const item = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith("on")) item.addEventListener(name.slice(2), value);
    else if (value === true) item.setAttribute(name, "");
    else if (value !== false && value !== null && value !== undefined)
      item.setAttribute(name, String(value));
  }
  for (const child of children.flat())
    if (child !== null && child !== undefined) item.append(child);
  return item;
}
export const heading = (title, eyebrow) =>
  el(
    "header",
    { class: "page-header" },
    eyebrow ? el("span", { class: "eyebrow" }, eyebrow) : null,
    el("h1", {}, title),
  );
export const panel = (title, ...children) =>
  el("section", { class: "panel" }, el("h2", {}, title), children.flat());
export const button = (label, action, primary = false) =>
  el(
    "button",
    { type: "button", class: primary ? "primary" : "", onclick: action },
    label,
  );
export const empty = (text = "Sin registros para mostrar.") =>
  el("p", { class: "empty" }, text);
export const pageSize = 25;
export function pager(offset, rows, go) {
  return el(
    "div",
    { class: "pagination" },
    offset ? button("Anterior", () => go(offset - pageSize)) : null,
    el("span", {}, `Página ${offset / pageSize + 1}`),
    rows.length === pageSize
      ? button("Siguiente", () => go(offset + pageSize))
      : null,
  );
}
export function table(columns, rows) {
  if (!rows.length) return empty();
  return el(
    "div",
    {
      class: "table-scroll",
      tabindex: "0",
      "aria-label": "Tabla de registros",
    },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          columns.map((name) => el("th", { scope: "col" }, name)),
        ),
      ),
      el(
        "tbody",
        {},
        rows.map((row) =>
          el(
            "tr",
            {},
            row.map((cell) => el("td", {}, cell ?? "—")),
          ),
        ),
      ),
    ),
  );
}
export const date = (iso) =>
  iso
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Bogota",
      }).format(new Date(iso))
    : "—";
export function money(raw, asset, scale = asset === "COP" ? 2 : 6) {
  if (raw === null || raw === undefined) return "—";
  const num = BigInt(raw);
  const whole = (num < 0n ? -num : num).toString().padStart(scale + 1, "0");
  return `${num < 0n ? "−" : ""}${whole.slice(0, -scale)}.${whole.slice(-scale)} ${asset}`;
}
export const id = () => window.crypto.randomUUID();
export const short = (value) =>
  String(value ?? "—")
    .split("-")
    .at(-1);
export const pill = (status) => el("span", { class: "pill" }, status);
export function form(label, inputs, action) {
  const submit = el("button", { type: "submit", class: "primary" }, label);
  const feedback = el("p", { role: "status", class: "feedback" });
  const control = el(
    "form",
    {
      class: "form-grid",
      onsubmit: async (event) => {
        event.preventDefault();
        if (submit.disabled) return;
        const data = Object.fromEntries(new FormData(control));
        submit.disabled = true;
        feedback.textContent = "Procesando…";
        feedback.className = "feedback";
        try {
          await action(data);
          feedback.textContent = "Operación registrada.";
        } catch (error) {
          feedback.className = "feedback error";
          feedback.textContent = `${error.message}${error.retryable ? " · Puedes reintentar." : ""}`;
        } finally {
          submit.disabled = false;
        }
      },
    },
    inputs.map(([name, title, params = {}]) => {
      const { choices, ...attrs } = params;
      const input = choices
        ? el(
            "select",
            { name, required: true, ...attrs },
            choices.map((choice) => {
              const [value, text] = Array.isArray(choice)
                ? choice
                : [choice, choice];
              return el(
                "option",
                { value, selected: value === attrs.value },
                text,
              );
            }),
          )
        : el("input", { name, required: true, ...attrs });
      return el("label", {}, title, input);
    }),
    el("div", { class: "submit" }, submit, feedback),
  );
  return control;
}
export const confirmAction = (message, fn) => {
  if (window.confirm(message)) return fn();
};
export const assets = ["COP", "USDT", "ARVE"];

export function listFilter(title, key, label, values, current, change) {
  return form(
    title,
    [
      [
        key,
        label,
        {
          choices: [["", "Todos"], ...values],
          value: current ?? "",
          required: false,
        },
      ],
    ],
    (data) => change(data[key]),
  );
}
