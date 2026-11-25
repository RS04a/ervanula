import { createElement, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { icon } from "./icons.js";
import { BrandImage } from "../site/brand.jsx";

const reactAttributes = {
  class: "className",
  tabindex: "tabIndex",
  onclick: "onClick",
};
// These factories let the existing view modules build React elements from their API results.
export function el(tag, attrs = {}, ...children) {
  const props = Object.fromEntries(
    Object.entries(attrs).map(([name, value]) => [
      reactAttributes[name] ?? name,
      value,
    ]),
  );
  if (tag === "a" && props.href?.startsWith("/admin/")) {
    const { href, ...linkProps } = props;
    return createElement(
      Link,
      { ...linkProps, to: href },
      ...children.flat(Infinity),
    );
  }
  return createElement(tag, props, ...children.flat(Infinity));
}
export const heading = (title, eyebrow, description) =>
  el(
    "header",
    { class: "page-header" },
    eyebrow ? el("span", { class: "eyebrow" }, eyebrow) : null,
    el("h1", {}, title),
    description ? el("p", { class: "page-subtitle" }, description) : null,
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
  el("p", { class: "empty" }, icon("empty"), text);
export const pageSize = 25;
export function pager(offset, rows, go) {
  if (!offset && !rows.length) return null;
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
export function table(columns, rows, emptyMessage) {
  if (!rows.length) return empty(emptyMessage);
  return el(
    "div",
    {
      class: "table-scroll",
      tabindex: "0",
      role: "region",
      "aria-label": `Tabla de registros: ${columns.slice(0, 3).join(", ")}`,
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
const statusTones = {
  success: ["COMPLETED", "CONFIRMED", "APPLIED", "DONE", "Activo"],
  warning: [
    "AWAITING_PAYMENT",
    "PENDING",
    "CONFIRMING",
    "REVIEW",
    "RUNNING",
    "EXPIRED",
  ],
  danger: ["REJECTED", "FAILED", "INVALID", "CANCELLED", "Inactivo"],
  blue: ["DRAFT", "PREVIEW", "DETECTED", "Simulación", "TronGrid", "ADMIN"],
};
export function pill(status, tone) {
  const style =
    tone ??
    Object.keys(statusTones).find((key) => statusTones[key].includes(status));
  return el("span", { class: "pill", "data-tone": style }, status);
}
export const callout = (text, warning = false) =>
  el(
    "p",
    { class: warning ? "callout callout-warning" : "callout", role: "note" },
    icon(warning ? "alert" : "clock"),
    text,
  );
export const metricCard = (title, value, symbol, note, tone = "blue") =>
  el(
    "section",
    { class: "panel metric-card" },
    el(
      "h2",
      { class: "metric-heading" },
      title,
      el("span", { class: "metric-icon", "data-tone": tone }, icon(symbol)),
    ),
    el("p", { class: "metric" }, value),
    note ? el("p", { class: "note" }, note) : null,
  );
export const split = (...panels) =>
  el("div", { class: "split" }, panels.filter(Boolean));
export const detailList = (items) =>
  el(
    "dl",
    { class: "detail-list" },
    items.map(([label, value]) =>
      el("div", {}, el("dt", {}, label), el("dd", {}, value)),
    ),
  );
export function feedbackMessage(error) {
  if (error instanceof TypeError || error instanceof SyntaxError)
    return "No se pudo obtener una respuesta de ARVELUNA. Intenta de nuevo.";
  return `${error.message}${error.retryable ? " · Puedes reintentar." : ""}`;
}
function Form({ label, inputs, action }) {
  const pending = useRef(false);
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    pending.current = true;
    setBusy(true);
    setFeedback({ text: "Procesando…" });
    try {
      const completed = await action(data);
      setFeedback(completed === false ? null : { text: "Listo." });
    } catch (error) {
      setFeedback({ text: feedbackMessage(error), error: true });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return el(
    "form",
    { class: "form-grid", onSubmit: submit, "aria-busy": busy },
    inputs.map(([name, title, params = {}]) => {
      const {
        choices,
        value,
        maxlength,
        autocomplete,
        inputmode,
        help,
        ...attrs
      } = params;
      const fieldId = `${formId}-${name}`;
      const helpId = `${fieldId}-ayuda`;
      const props = {
        id: fieldId,
        name,
        required: true,
        ...attrs,
        defaultValue: value,
        maxLength: maxlength,
        autoComplete: autocomplete,
        inputMode: inputmode,
        "aria-describedby": help ? helpId : undefined,
      };
      const input = choices
        ? el(
            "select",
            props,
            choices.map((choice) => {
              const [key, text] = Array.isArray(choice)
                ? choice
                : [choice, choice];
              return el("option", { key, value: key }, text);
            }),
          )
        : el("input", props);
      return el(
        "div",
        { key: name, class: "form-field" },
        el("label", { htmlFor: fieldId }, title),
        input,
        help ? el("p", { id: helpId, class: "field-help" }, help) : null,
      );
    }),
    el(
      "div",
      { class: "submit" },
      el("button", { type: "submit", class: "primary", disabled: busy }, label),
      el(
        "p",
        {
          role: feedback?.error ? "alert" : "status",
          class: feedback?.error ? "feedback error" : "feedback",
        },
        feedback?.text,
      ),
    ),
  );
}

export function form(label, inputs, action) {
  return createElement(Form, { key: label, label, inputs, action });
}
export const assets = ["COP", "USDT", "ARVE"];

export function assetLabel(asset, label = asset) {
  return asset === "ARVE"
    ? el(
        "span",
        { class: "arve-label" },
        createElement(BrandImage, { variant: "arve", decorative: true }),
        label,
      )
    : label;
}

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

export function networkName(network) {
  if (network === "shasta") return "Shasta TESTNET";
  if (network === "nile") return "Nile TESTNET";
  return network === "mainnet" ? "Mainnet" : network;
}
export function paymentProfiles(settings) {
  const profiles = [["USDT", settings]];
  if (settings.arve) profiles.push(["ARVE", settings.arve]);
  return profiles.map(([asset, profile]) =>
    pill(
      assetLabel(
        asset,
        `${asset} · ${networkName(profile.network)} · ${profile.provider === "simulated" ? "Simulación" : "TronGrid"}`,
      ),
      profile.network === "mainnet" ? "blue" : "warning",
    ),
  );
}
