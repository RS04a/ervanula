import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { merchantFixture } from "../../backend/test/full-app/fixtures";

async function nav(page: Page, title: string) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: title, exact: true })
    .click();
}
async function product(
  page: Page,
  sku: string,
  asset: string,
  price: string,
  stock: string,
) {
  await nav(page, "Productos");
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page
    .getByLabel("Descripción", { exact: true })
    .fill(sku === "CAFE" ? "Café molido" : "Producto digital");
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
    .selectOption({
      label:
        sku === "CAFE" ? "CAFE · Café molido" : "DIGITAL · Producto digital",
    });
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
  await page.getByRole("button", { name: "Iniciar checkout" }).click();
  await expect(
    page
      .getByText(asset === "COP" ? "COMPLETED" : "AWAITING_PAYMENT", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
}
test("recorridos A, B, C y D en la aplicación", async ({ page }, info) => {
  const person = await merchantFixture();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/app.html");
  await page.getByLabel("Correo", { exact: true }).fill(person.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(person.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByText(/Administración de prueba · ADMIN/),
  ).toBeVisible();
  await test.step("A · efectivo desde la caja hasta el cierre", async () => {
    await nav(page, "Caja");
    await page.getByLabel("Saldo inicial (COP)").fill("100");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(
      page.getByRole("heading", { name: "Caja abierta" }),
    ).toBeVisible();
    await product(page, "CAFE", "COP", "30", "4");
    await checkout(page, "COP", "CAFE · Café molido", "2");
    await nav(page, "Caja");
    await expect(
      page.getByText("160.00 COP", { exact: true }).first(),
    ).toBeVisible();
    await page.getByLabel("Efectivo contado (COP)").fill("155");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page.getByText("−5.00 COP", { exact: true })).toBeVisible();
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
    await page.screenshot({
      path: `docs/full-app/capturas/${info.project.name}-pago.png`,
      fullPage: true,
    });
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
    await page.screenshot({
      path: `docs/full-app/capturas/${info.project.name}-importacion.png`,
      fullPage: true,
    });
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
    await nav(page, "Dashboard");
    await expect(page.getByText("60.00 COP", { exact: true })).toBeVisible();
    await expect(
      page.getByText("10.000000 USDT", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `docs/full-app/capturas/${info.project.name}-dashboard.png`,
      fullPage: true,
    });
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
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
});
