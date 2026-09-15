import js from "@eslint/js";
import globals from "globals";

/**
 * ESLint設定（flat config）。
 *
 * ビルドステップは増やさない静的チェックのみ（docs/BEST_PRACTICES_AUDIT.md参照）。
 * TypeScriptの型チェックはtsconfig.json（checkJs）側で行うため、ここでは
 * 型に関するルールは扱わず、素のJavaScriptの一般的な誤りの検出に留める。
 */
export default [
  { ignores: ["node_modules/**", "out/**", "data/**", "coverage/**", ".stryker-tmp/**", "reports/**"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
