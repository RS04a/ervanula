import { api } from "./api.js";
const $ = (id) => document.getElementById(id);
let order;
let busy = false;
function showOrder() {
  const panel = $("order");
  panel.replaceChildren();
  for (const [label, value] of Object.entries({
    Orden: order.id,
    Red: order.network,
    Token: order.tokenSymbol,
    Contrato: order.tokenContract,
    Dirección: order.recipientAddress,
    "Monto USDT": `${order.amountBaseUnits.padStart(7, "0").slice(0, -6)}.${order.amountBaseUnits.padStart(7, "0").slice(-6)}`,
    Estado: order.status,
    Vencimiento: new Date(order.expiresAt).toLocaleString(),
  })) {
    const row = document.createElement("p");
    row.className = "mb-2 break-all";
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    row.append(strong, document.createTextNode(value));
    panel.append(row);
  }
}
async function refresh() {
  order = await api.get(order.id);
  showOrder();
  const events = await api.audit(order.id);
  $("audit").replaceChildren(
    ...events.map((event) => {
      const li = document.createElement("li");
      li.textContent = `${new Date(event.createdAt).toLocaleTimeString()} · ${event.eventType} · ${event.previousStatus ?? "—"} → ${event.newStatus}${event.failureCode ? " · " + event.failureCode : ""}`;
      return li;
    }),
  );
}
async function run(task) {
  if (busy) return;
  busy = true;
  for (const button of document.querySelectorAll("button"))
    button.disabled = true;
  $("message").textContent = "Procesando solicitud…";
  try {
    await task();
    $("message").textContent =
      `Orden ${order.status}${order.failureCode ? " · " + order.failureCode : ""}`;
  } catch (error) {
    $("message").textContent =
      error.message +
      (error.requestId ? ` · Referencia: ${error.requestId}` : "");
    if (order)
      try {
        await refresh();
      } catch {
        /* Preserve the original error on failed refresh. */
      }
  } finally {
    busy = false;
    for (const button of document.querySelectorAll("button"))
      button.disabled = false;
    if (!order)
      for (const id of ["verify", "copy", "refresh"]) $(id).disabled = true;
  }
}
$("create-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void run(async () => {
    order = await api.create(Object.fromEntries(new FormData(event.target)));
    await refresh();
  });
});
$("verify-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (order)
    void run(async () => {
      await api.verify(order.id, $("hash").value.trim());
      await refresh();
    });
});
$("refresh").addEventListener("click", () => void run(refresh));
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(order.recipientAddress);
    $("message").textContent = "Dirección copiada.";
  } catch {
    $("message").textContent =
      "No se pudo copiar. Selecciona la dirección del detalle.";
  }
});
$("scenario").addEventListener("change", (event) => {
  $("hash").value = `demo:${event.target.value}:001`;
});
