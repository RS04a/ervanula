import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
test("los diagramas C4 y de secuencia renderizan con Mermaid", async ({
  page,
}) => {
  await page.goto("/");
  await page.addScriptTag({
    path: resolve("node_modules/mermaid/dist/mermaid.min.js"),
  });
  const files = readdirSync("docs").filter(
    (name) => name.startsWith("c4-") || name.startsWith("sequence-"),
  );
  for (const [index, file] of files.entries()) {
    const source = readFileSync(resolve("docs", file), "utf8").match(
      /```mermaid\s*([\s\S]*?)```/,
    )?.[1];
    expect(source, file).toBeTruthy();
    const svg = await page.evaluate(
      async ({ source, index }) => {
        const m = (
          window as unknown as {
            mermaid: {
              initialize: (config: unknown) => void;
              render: (id: string, source: string) => Promise<{ svg: string }>;
            };
          }
        ).mermaid;
        m.initialize({ startOnLoad: false, securityLevel: "strict" });
        return (await m.render(`diagram${index}`, source!)).svg;
      },
      { source, index },
    );
    expect(svg).toContain("<svg");
  }
});
