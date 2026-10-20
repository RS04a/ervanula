import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    files: ["scripts/*.mjs"],
    languageOptions: { globals: { console: "readonly" } },
  },
  { ignores: ["**/dist/**", "**/public/**", "node_modules/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["frontend/src/*.js"],
    languageOptions: {
      globals: {
        FormData: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
);
