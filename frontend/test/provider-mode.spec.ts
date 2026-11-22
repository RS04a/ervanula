import { test, expect } from "@playwright/test";
test("modo TronGrid muestra lectura real y desactiva hashes sintéticos sin consultar internet", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        service: "payments",
        provider: "trongrid",
        network: "shasta",
      }),
    }),
  );
  await page.goto("/");
  await expect(page.locator("#provider")).toContainText(
    "TRONGRID · SHASTA · SOLO LECTURA",
  );
  await expect(page.locator("#scenario")).toBeHidden();
  await expect(page.locator("#hash")).toHaveValue("");
  await expect(page.locator("#hash")).toHaveAttribute(
    "placeholder",
    "Hash hexadecimal de 64 caracteres",
  );
  await expect(page.locator("#provider-description")).toContainText(
    "no firma ni envía",
  );
});
