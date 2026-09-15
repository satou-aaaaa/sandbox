import js from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";

/**
 * ESLint設定（flat config）。
 *
 * ビルドステップは増やさない静的チェックのみ（docs/BEST_PRACTICES_AUDIT.md参照）。
 * TypeScriptの型チェックはtsconfig.json（checkJs）側で行うため、ここでは
 * 型に関するルールは扱わず、素のJavaScriptの一般的な誤りの検出に留める。
 *
 * `eslint-plugin-security`（2026年9月導入・ADR-0012）はSAST（静的解析による
 * セキュリティ検査）の一種。既知のベンチマーク（DEV Community記事）では
 * 検出率が高くない（27.5%程度）と報告されているが、`eslint-community`
 * 組織が保守する実績のあるプラグインであり、追加コストがほぼゼロ
 * （既存の`npm run lint`にルールが増えるだけ）なので導入する。より高い
 * 検出率を謳う無名のプラグイン群（"Interlace Ecosystem"等）は、出所を
 * 確認できずサプライチェーンリスクの観点から見送った。
 */
export default [
  { ignores: ["node_modules/**", "out/**", "data/**", "coverage/**", ".stryker-tmp/**", "reports/**", ".claude/**"] },
  js.configs.recommended,
  security.configs.recommended,
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
      // docx生成モジュールはファイル書き出し先を呼び出し元(サンプルスクリプト・
      // Webサーバーのセッションディレクトリ)から組み立てるため、多くの箇所で
      // 変数を使ったオブジェクトプロパティアクセス・パス結合が発生する。
      // 実際の入力元は常にコード内で組み立てた値であり外部入力を直接
      // オブジェクトキーに使うことはないため、誤検知が多い
      // detect-object-injection は警告に留める（禁止はしない）。
      "security/detect-object-injection": "warn",
      // このアプリのファイルI/Oは、テスト容易性のためほぼ全箇所で出力先パスを
      // 引数（filePath）として受け取る設計にしている（clientStore.js・
      // draftStore.js・scripts/*.js・test/*.js）。このルールは「変数を使った
      // fs呼び出し」を機械的に全件検出するため、この設計だけで15件以上の
      // 誤検知が発生し、S/N比が悪すぎて有効化する価値がない。
      // 実際に外部入力（HTTPリクエストのURL）由来のパスを扱う唯一の箇所
      // （src/web/server.js のダウンロード配信）は、パストラバーサル対策を
      // 個別に実装・テスト済み（test/web.test.js「/download はディレクトリ
      // トラバーサルを拒否する」）であることを導入時に確認済み。
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];
