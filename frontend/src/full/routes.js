export const adminSegments = {
  dashboard: "dashboard",
  inventory: "inventario",
  products: "inventario/productos",
  sales: "ventas",
  cash: "caja",
  payments: "pagos",
  imports: "importacion",
  diagnostics: "analisis",
  simulation: "analisis/simulaciones",
  recommendations: "analisis/recomendaciones",
  settings: "configuracion",
};

export const adminLogin = "/admin/login";
const records = new Set(["sales", "payments", "imports"]);

export function adminUrl(view, selected) {
  return `/admin/${adminSegments[view]}${selected ? `/${encodeURIComponent(selected)}` : ""}`;
}

export function readAdminRoute(pathname) {
  const path = pathname.replace(/\/$/, "");
  for (const [view, segment] of Object.entries(adminSegments)) {
    const prefix = "/admin/" + segment;
    if (path === prefix) return { view, selected: null };
    if (records.has(view) && path.startsWith(prefix + "/")) {
      const selected = path.slice(prefix.length + 1);
      if (/^[\w-]+$/.test(selected)) return { view, selected };
    }
  }
  return null;
}
