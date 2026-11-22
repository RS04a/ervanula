export async function api(path, body, signal) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "x-arveluna-csrf": "1",
          },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.message ?? "Error de conexión");
    error.status = response.status;
    error.code = result.error?.code;
    error.retryable = result.error?.retryable;
    throw error;
  }
  return result;
}
