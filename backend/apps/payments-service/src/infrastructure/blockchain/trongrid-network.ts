export const TRONGRID_ORIGINS: Readonly<Record<string, string>> = Object.freeze(
  {
    mainnet: "https://api.trongrid.io",
    shasta: "https://api.shasta.trongrid.io",
    nile: "https://nile.trongrid.io",
  },
);
export function validateTronGridEndpoint(
  baseUrl: string,
  network: string,
): string {
  const url = new URL(baseUrl);
  if (
    url.origin !== TRONGRID_ORIGINS[network] ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "TRONGRID_BASE_URL debe coincidir con el endpoint HTTPS oficial de TRON_NETWORK",
    );
  return url.origin;
}
