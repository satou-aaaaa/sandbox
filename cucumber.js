/**
 * Cucumber.js（BDD/Gherkin）の設定。
 *
 * 【なぜ導入したか】発注者（行政書士）自身が、プログラムを読まなくても
 * 「どの法令要件がどう判定されるか」をGherkin記法（自然文の
 * シナリオ）で直接確認できるようにするため。既存の`node --test`による
 * ユニットテスト（`docs/DESIGN.md` 7章）を置き換えるものではなく、
 * 法令根拠が特に重要な判定ロジックについて、業務言語で書かれた
 * 受け入れ基準を別レイヤーとして追加するもの。
 *
 * 【CLAUDE.mdの既存方針との関係】CLAUDE.mdの「テスト」節は
 * 「Jest/Vitest等の外部テストフレームワークは導入しない」としており、
 * 本来はこの方針に反する。発注者の明示的な指示により、Gherkin/BDDに
 * 限定した例外として導入した（経緯は`docs/adr/0016-cucumber-bdd-for-gherkin.md`
 * 参照）。既存の`npm test`（`node --test`。コミット前必須）には含めず、
 * `npm run test:bdd`として独立させている。
 *
 * ステップ定義はESM（`import`）で書くため、Cucumber公式の推奨どおり
 * `--require`ではなく`--import`を使う。
 */
export default {
  default: {
    paths: ["features/**/*.feature"],
    import: ["features/support/**/*.js", "features/step_definitions/**/*.js"],
    format: ["progress-bar"],
    language: "ja",
  },
};
