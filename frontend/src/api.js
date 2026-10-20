const GATEWAY = "http://localhost:3000/api";
async function request(path, body) {
  const response = await fetch(`${GATEWAY}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      `${result.error.message} (${result.error.code})${result.error.retryable ? " · Puedes reintentar." : ""}`,
    );
    error.requestId = result.requestId;
    throw error;
  }
  return result;
}
export const api = {
  create: (input) => request("payments/orders", input),
  get: (id) => request(`payments/orders/${id}`),
  verify: (id, transactionHash) =>
    request(`payments/orders/${id}/verify`, { transactionHash }),
  audit: (id) => request(`payments/orders/${id}/audit`),
};
