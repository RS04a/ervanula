import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { merchantFixture } from "../../backend/test/full-app/fixtures";

async function nav(page: Page, title: string) {
  const groups = {
    Productos: "Inventario",
    Diagnósticos: "Análisis",
    Simulaciones: "Análisis",
    Recomendaciones: "Análisis",
  } as const;
  const group = groups[title as keyof typeof groups];
  const menu = page.getByRole("button", { name: "Menú", exact: true });
  const main = page.getByRole("navigation", { name: "Navegación principal" });
  const tabs = group
    ? page.getByRole("navigation", { name: group, exact: true })
    : null;
  if (!tabs || !(await tabs.isVisible())) {
    if (
      (await menu.isVisible()) &&
      (await menu.getAttribute("aria-expanded")) === "false"
    )
      await menu.click();
    await main.getByRole("link", { name: group ?? title, exact: true }).click();
  }
  if (tabs) await tabs.getByRole("link", { name: title, exact: true }).click();
}
async function capture(page: Page, info: TestInfo, name: string) {
  const viewportFits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(
    viewportFits,
    `Vista ${name} sin desbordamiento de página`,
  ).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
}
async function product(
  page: Page,
  sku: string,
  asset: string,
  price: string,
  stock: string,
) {
  const description = sku === "CAFE" ? "Café molido" : "Producto digital";
  await nav(page, "Productos");
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page.getByLabel("Descripción", { exact: true }).fill(description);
  await page
    .getByRole("combobox", { name: "Activo", exact: true })
    .selectOption(asset);
  await page.getByLabel("Precio unitario").fill(price);
  await page.getByLabel("Mínimo de existencias").fill("5");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(
    page.getByRole("cell", { name: sku, exact: true }),
  ).toBeVisible();
  await nav(page, "Inventario");
  await page
    .getByRole("combobox", { name: "Producto", exact: true })
    .selectOption({ label: `${sku} · ${description}` });
  await page.getByLabel("Unidades").fill(stock);
  await page.getByLabel("Motivo").fill("Lote inicial");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Lote inicial" }).first(),
  ).toBeVisible();
}
async function checkout(
  page: Page,
  asset: string,
  product: string,
  quantity: string,
) {
  await nav(page, "Ventas");
  await page
    .getByRole("combobox", { name: "Activo de la venta", exact: true })
    .selectOption(asset);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await page
    .getByRole("combobox", { name: "Producto", exact: true })
    .selectOption({ label: product });
  await page.getByLabel("Cantidad", { exact: true }).fill(quantity);
  await page.getByRole("button", { name: "Guardar artículo" }).click();
  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(
    page
      .getByRole("heading", { name: /^Venta / })
      .locator("..")
      .getByText(asset === "COP" ? "COMPLETED" : "AWAITING_PAYMENT", {
        exact: true,
      }),
  ).toBeVisible({ timeout: 45_000 });
}
test("recorridos A, B, C y D en la aplicación", async ({ page }, info) => {
  test.setTimeout(180_000);
  const person = await merchantFixture();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/login");
  await page.getByLabel("Correo", { exact: true }).fill(person.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(person.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Menú", exact: true });
  if (await menu.isVisible()) await menu.click();
  await expect(
    page
      .getByRole("complementary")
      .getByText("Administración de prueba", { exact: true }),
  ).toBeVisible();
  await test.step("A · efectivo desde la caja hasta el cierre", async () => {
    await nav(page, "Caja");
    await page.getByLabel("Saldo inicial (COP)").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(
      page.getByRole("heading", { name: "Caja abierta" }),
    ).toBeVisible();
    await product(page, "CAFE", "COP", "30", "4");
    await expect(page.getByLabel("Unidades")).toHaveAccessibleDescription(
      /entero positivo/,
    );
    await page
      .getByRole("button", { name: "Ver movimientos", exact: true })
      .click();
    await expect(
      page.getByText("Movimientos de CAFE", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Quitar filtro" }).click();
    await expect(
      page.getByText("Movimientos de CAFE", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Tipo", exact: true })
      .selectOption("OUT");
    await page.getByLabel("Unidades").fill("5");
    await page.getByLabel("Motivo").fill("Prueba de stock insuficiente");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Existencias insuficientes",
    );
    await expect(
      page.getByRole("cell", { name: "Prueba de stock insuficiente" }),
    ).toHaveCount(0);
    await page.getByLabel("Motivo").clear();
    await capture(page, info, "inventario");
    await checkout(page, "COP", "CAFE · Café molido", "2");
    await capture(page, info, "ventas");
    await nav(page, "Caja");
    await expect(
      page.getByText("160.00 COP", { exact: true }).first(),
    ).toBeVisible();
    await page.getByLabel("Efectivo contado (COP)").fill("155");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page.getByText("−5.00 COP", { exact: true })).toBeVisible();
    await capture(page, info, "caja");
  });
  await test.step("B · TRC-20 y auditoría", async () => {
    await nav(page, "Configuración");
    await page
      .getByLabel("Dirección pública")
      .fill("TJRabPrwbZy45sbavfcjinPJC18kjpRTv8");
    await page.getByRole("button", { name: "Guardar billetera" }).click();
    await expect(
      page.getByRole("cell", { name: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8" }),
    ).toBeVisible();
    await capture(page, info, "configuracion");
    await product(page, "DIGITAL", "USDT", "10", "2");
    await checkout(page, "USDT", "DIGITAL · Producto digital", "1");
    const url = page.url();
    await page.getByRole("link", { name: "Ver orden de pago" }).click();
    await page
      .getByLabel("Hash de transacción")
      .fill(`demo:unavailable:${randomUUID()}`);
    await page.getByRole("button", { name: "Verificar transacción" }).click();
    await expect(page.getByText(/Puedes reintentar/)).toBeVisible();
    await page
      .getByLabel("Hash de transacción")
      .fill(`demo:multi:${randomUUID()}`);
    await page.getByRole("button", { name: "Verificar transacción" }).click();
    await expect(
      page.getByRole("cell", { name: "PAYMENT_VERIFIED" }),
    ).toBeVisible();
    await capture(page, info, "pagos");
    await page.goto(url);
    await expect(
      page
        .getByRole("heading", { name: /^Venta / })
        .locator("..")
        .getByText("COMPLETED", { exact: true }),
    ).toBeVisible();
    await nav(page, "Caja");
    await expect(
      page.getByRole("cell", { name: "DIGITAL_SALE" }),
    ).toBeVisible();
  });
  await test.step("C · importación y progreso", async () => {
    await nav(page, "Importación");
    await page.getByLabel("Archivo CSV").setInputFiles({
      name: "productos.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "sku,description,asset,price,minimum,opening_quantity\nTAZA,Taza pequeña,COP,7.5,5,2\nERROR,Inválido,COP,no,0,1\n",
      ),
    });
    await page.getByRole("button", { name: "Ver vista previa" }).click();
    await expect(
      page
        .getByRole("cell", { name: "INVALID_PRICE", exact: true })
        .or(page.getByRole("cell", { name: "INVALID_AMOUNT", exact: true })),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar importación" }).click();
    await expect(
      page.getByRole("cell", { name: "APPLIED", exact: true }),
    ).toBeVisible();
    await capture(page, info, "importacion");
  });
  await test.step("D · diagnóstico, simulación y explicación", async () => {
    await nav(page, "Diagnósticos");
    await page.getByRole("button", { name: "Reconciliar datos" }).click();
    await expect(page.getByRole("cell", { name: "60.00 COP" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "10.000000 USDT" }),
    ).toBeVisible();
    await nav(page, "Simulaciones");
    await page
      .getByRole("combobox", { name: "Producto", exact: true })
      .selectOption({ label: "CAFE · Café molido" });
    await page.getByLabel("Cambio de precio").fill("1000");
    await page.getByLabel("Cambio de demanda").fill("5000");
    await page.getByRole("button", { name: "Calcular escenario" }).click();
    await expect(page.getByRole("cell", { name: "99.00 COP" })).toBeVisible();
    await nav(page, "Recomendaciones");
    await expect(
      page.getByText("Disponible < mínimo", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("CAFE · disponible 2 · mínimo 5", { exact: true }),
    ).toBeVisible();
    await capture(page, info, "analisis");
    await nav(page, "Resumen");
    const totals = page
      .getByRole("heading", { name: "Ventas por activo", exact: true })
      .locator("..");
    await expect(totals.getByText("60.00 COP", { exact: true })).toBeVisible();
    await expect(
      totals.getByText("10.000000 USDT", { exact: true }),
    ).toBeVisible();
    await capture(page, info, "resumen");
  });
  await test.step("Marca de ArveCoins en una orden ARVE de prueba", async () => {
    await nav(page, "Configuración");
    await page
      .getByRole("combobox", { name: "Red TRON" })
      .selectOption("shasta");
    await page
      .getByRole("combobox", { name: "Activo", exact: true })
      .selectOption("ARVE");
    await page
      .getByLabel("Dirección pública")
      .fill("TJRabPrwbZy45sbavfcjinPJC18kjpRTv8");
    await page.getByRole("button", { name: "Guardar billetera" }).click();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "ARVE" })
        .getByRole("cell", { name: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8" }),
    ).toBeVisible();
    await product(page, "TOKEN", "ARVE", "10", "2");
    await checkout(page, "ARVE", "TOKEN · Producto digital", "1");
    await page.getByRole("link", { name: "Ver orden de pago" }).click();
    const profile = page.getByText("ARVE · Shasta TESTNET · Simulación", {
      exact: true,
    });
    await expect(profile.locator("img")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "10.000000 ARVE" }).locator("img"),
    ).toHaveAttribute("src", "/brand/arvecoins-token.png");
    await expect(
      page.getByRole("cell", { name: "10.000000 USDT" }).locator("img"),
    ).toHaveCount(0);
    await capture(page, info, "pagos-arve");
  });
  await test.step("filtros, paginación y recarga con la sesión activa", async () => {
    for (let index = 0; index < 25; index++) {
      const response = await page.request.post("/api/inventory/products", {
        headers: { origin: "http://localhost:15173", "x-arveluna-csrf": "1" },
        data: {
          sku: `PAGE-${index}`,
          description: "Prueba de página",
          asset: "COP",
          price: "1.00",
          minimum: 0,
        },
      });
      expect(response.ok()).toBeTruthy();
    }
    await nav(page, "Productos");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
    await page.getByLabel("SKU o descripción").fill("PAGE-17");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(
      page.getByRole("cell", { name: "PAGE-17", exact: true }),
    ).toBeVisible();
    await nav(page, "Pagos");
    await page
      .getByRole("combobox", { name: "Estado de orden" })
      .selectOption("CONFIRMED");
    await page.getByRole("button", { name: "Filtrar órdenes" }).click();
    await page.getByRole("link", { name: "Abrir orden" }).click();
    await page.reload();
    await expect(
      page.getByRole("cell", { name: "PAYMENT_VERIFIED" }),
    ).toBeVisible();
  });
  await test.step("El CSV de demostración se valida en el importador real", async () => {
    await nav(page, "Importación");
    await page
      .getByLabel("Archivo CSV")
      .setInputFiles("docs/full-app/PRODUCTOS_DEMO.csv");
    await page.getByRole("button", { name: "Ver vista previa" }).click();
    await expect(
      page.getByRole("cell", { name: "PENDING", exact: true }),
    ).toHaveCount(10);
    await expect(
      page.getByRole("cell", { name: "INVALID", exact: true }),
    ).toHaveCount(0);
  });
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute("aria-expanded")) === "false"
  )
    await menu.click();
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
});

test("carga, vacío, error recuperable y permisos en el nuevo panel", async ({
  page,
}, info) => {
  const { email, password } = await merchantFixture();
  const cashier = `cashier-${randomUUID()}@example.test`;
  const cashierPassword = randomUUID();
  const menu = page.getByRole("button", { name: "Menú", exact: true });
  const main = page.getByRole("main");
  async function login(name: string, key: string) {
    await page.getByLabel("Correo", { exact: true }).fill(name);
    await page.getByLabel("Contraseña", { exact: true }).fill(key);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  await page.goto("/admin/login");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const dashboardSales = (url: URL) =>
    url.pathname === "/api/sales/sales" &&
    url.searchParams.get("offset") === "0";
  await page.route(
    dashboardSales,
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  try {
    await login(email, password);
    await expect(main.getByRole("status")).toHaveText("Cargando…");
    await expect(main).toHaveAttribute("aria-busy", "true");
  } finally {
    release();
  }
  await expect(
    main.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeVisible();
  await expect(main.getByText("Aún no hay ventas registradas.")).toBeVisible();
  await expect(main).toHaveAttribute("aria-busy", "false");

  if (await menu.isVisible()) {
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await capture(page, info, "menu");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  }
  const skip = page.getByRole("link", { name: "Ir al contenido" });
  await expect(skip).toHaveCSS("opacity", "0");
  await skip.focus();
  await expect(skip).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(main).toBeFocused();

  await page.route(
    "**/api/payments/settings",
    (route) =>
      route.fulfill({
        status: 503,
        json: { error: { message: "Servicio no disponible temporalmente" } },
      }),
    { times: 1 },
  );
  await nav(page, "Pagos");
  await expect(main.getByRole("alert")).toHaveText(
    "Servicio no disponible temporalmente",
  );
  await main.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    main.getByText("ARVE · Shasta TESTNET · Simulación"),
  ).toBeVisible();
  await expect(main.getByRole("heading", { name: "Órdenes" })).toBeVisible();

  const response = await page.request.post("/api/identity/users", {
    headers: { origin: "http://localhost:15173", "x-arveluna-csrf": "1" },
    data: {
      email: cashier,
      password: cashierPassword,
      displayName: "Caja de prueba",
      role: "CASHIER",
    },
  });
  expect(response.ok()).toBeTruthy();
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute("aria-expanded")) === "false"
  )
    await menu.click();
  await page.getByRole("button", { name: "Salir" }).click();
  await login(cashier, cashierPassword);
  await expect(
    main.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  const navigation = page.getByRole("navigation", {
    name: "Navegación principal",
  });
  await expect(
    navigation.getByRole("link", { name: "Importación" }),
  ).toHaveCount(0);
  await page.goto("/admin/importacion");
  await expect(main.getByRole("alert")).toHaveText("Se requiere rol ADMIN.");
  expect((await page.request.get("/api/imports/jobs")).status()).toBe(403);
  const merchantEdit = await page.request.post("/api/merchant/profile", {
    headers: { origin: "http://localhost:15173", "x-arveluna-csrf": "1" },
    data: { name: "Cambio restringido" },
  });
  expect(merchantEdit.status()).toBe(403);
});

test("portada pública y rutas privadas de administración", async ({
  page,
}, info) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) apiRequests.push(path);
  });
  await page.goto("/");
  for (const area of ["banner", "contentinfo"] as const) {
    const logo = page.getByRole(area).getByAltText("ARVELUNA", { exact: true });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveJSProperty("naturalWidth", 2152);
    expect((await logo.boundingBox())?.width).toBeGreaterThanOrEqual(120);
  }
  const favicon = "/brand/arveluna-symbol.png";
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    favicon,
  );
  expect((await page.request.get(favicon)).ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Gestiona tu comercio con claridad." }),
  ).toBeVisible();
  await expect(
    page.getByText("Universidad del Norte", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Alberto Russell" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Yalal Ajram Elneser" }),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
  await capture(page, info, "portada");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Entrar al panel" })
    .click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await expect(page.getByRole("banner").getByAltText("ARVELUNA")).toBeVisible();
  await capture(page, info, "login");
  const protectedRoutes = [
    "/admin",
    "/admin/dashboard",
    "/admin/inventario",
    "/admin/inventario/productos",
    "/admin/ventas",
    "/admin/caja",
    "/admin/pagos",
    "/admin/importacion",
    "/admin/analisis",
    "/admin/analisis/simulaciones",
    "/admin/analisis/recomendaciones",
    "/admin/configuracion",
  ];
  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page, route).toHaveURL(/\/admin\/login$/);
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
  }
  expect((await page.request.get("/api/identity/session")).status()).toBe(401);
  expect((await page.request.get("/api/imports/jobs")).status()).toBe(401);
  await page.goto("/app.html#payments");
  await expect(page).toHaveURL(/\/admin\/login$/);

  const admin = await merchantFixture();
  await page.goto("/admin/caja");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("Correo", { exact: true }).fill(admin.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/caja$/);
  await expect(
    page.getByRole("heading", { name: "Caja", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/caja$/);
  await expect(
    page.getByRole("heading", { name: "Caja", exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", { name: "Menú", exact: true });
  if (await menu.isVisible()) {
    await expect(
      page.getByRole("banner").locator(".brand-image--symbol"),
    ).toBeVisible();
    await menu.click();
  }
  await expect(
    page.getByRole("complementary").locator(".brand-image--symbol"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get("/api/identity/session")).status()).toBe(401);
  await page.goto("/admin/caja");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
