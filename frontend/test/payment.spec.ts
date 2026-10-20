import { test, expect } from "@playwright/test";
test("creación, confirmación, auditoría, duplicado y recuperación desde el navegador", async ({
  page,
}) => {
  page.on("pageerror", (error) => console.error("PAGE ERROR", error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Crear orden" }).click();
  await expect(page.locator("#order")).toContainText("PENDING");
  await page.locator("#hash").fill(`demo:valid:browser-${Date.now()}`);
  await page.getByRole("button", { name: "Verificar transferencia" }).click();
  await expect(page.locator("#order")).toContainText("CONFIRMED");
  await expect(page.locator("#audit")).toContainText("PAYMENT_VERIFIED");
  await page.getByRole("button", { name: "Crear orden" }).click();
  await expect(page.locator("#order")).toContainText("PENDING");
  await page.getByRole("button", { name: "Verificar transferencia" }).click();
  await expect(page.locator("#message")).toContainText("DUPLICATE_TRANSACTION");
  await page.locator("#scenario").selectOption("unavailable");
  await page.getByRole("button", { name: "Verificar transferencia" }).click();
  await expect(page.locator("#message")).toContainText("Puedes reintentar");
  await expect(page.locator("#order")).toContainText("PENDING");
  await page.locator("#scenario").selectOption("recipient");
  await page.getByRole("button", { name: "Verificar transferencia" }).click();
  await expect(page.locator("#order")).toContainText("REJECTED");
  await page.screenshot({ path: "docs/demo-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/demo-mobile.png", fullPage: true });
});
