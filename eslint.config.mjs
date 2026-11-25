import js from "@eslint/js";
import ts from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
export default ts.config(
  {
    files: ["scripts/*.mjs"],
    languageOptions: { globals: { console: "readonly" } },
  },
  { ignores: ["**/dist/**", "**/public/**", "node_modules/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["frontend/src/**/*.{js,jsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        AbortController: "readonly",
        FormData: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        URL: "readonly",
        Uint8Array: "readonly",
        btoa: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
  {
    files: ["frontend/src/**/*.jsx"],
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
