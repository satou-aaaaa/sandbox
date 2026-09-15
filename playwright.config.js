import { defineConfig, devices } from "@playwright/test";

/**
 * E2Eテスト（Playwright）の設定。
 *
 * 【なぜ導入したか】これまでのテストはユニットテスト・property-based
 * testing・ミューテーションテスト・axe-core（jsdom）によるアクセシビリティ
 * 検証まで揃えたが、いずれも「実ブラウザで実際にクリック・入力して操作した
 * ときに動くか」までは検証していなかった。`docs/DESIGN.md` 7章では
 * 従来「外部サービス連携やUI操作を伴う画面遷移が無いためE2Eは導入しない」
 * としていたが、発注者の判断で方針を見直し導入した（ADR-0012参照）。
 *
 * 【スコープ】インテイクフォームの実際のブラウザ操作（入力→送信→結果画面
 * 確認、下書き保存）という「golden path」の疎通確認に限定する。個々の
 * 判定ロジックの正しさ（法定要件の分岐網羅等）は既存のユニットテスト・
 * ミューテーションテストが担っており、E2Eで重複して検証しない
 * （実行が遅く、失敗時の原因切り分けもしづらいE2Eは疎通確認に留めるのが
 * 定石という一般的なテストピラミッドの考え方に沿う）。
 *
 * 【実データを汚さない工夫】`npm run web`（本番相当の起動）はそのまま
 * `data/clients.json`・`out/web/`を使うが、E2Eテストは環境変数
 * （OUT_DIR/CLIENTS_PATH/DRAFTS_PATH。src/web/server.js参照）で
 * `.e2e-tmp/`配下の一時ファイルを使うよう起動し、実データと混在しない
 * ようにしている（`.e2e-tmp/`は.gitignore対象）。
 */
const PORT = 3101;

export default defineConfig({
  // node --testはデフォルトで「test/」という名前のディレクトリ配下の
  // .jsファイルを全て自動検出してしまうため（*.test.jsという命名規則の
  // ファイルに限らない）、test/配下にPlaywrightの仕様ファイルを置くと
  // node --test 実行時にも誤って拾われてエラーになる。node --testの
  // テスト対象（test/）とPlaywrightのE2Eテスト対象を明確に分離するため、
  // プロジェクト直下の専用ディレクトリ（e2e/）に置く。
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node src/web/server.js",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    env: {
      PORT: String(PORT),
      OUT_DIR: ".e2e-tmp/out",
      CLIENTS_PATH: ".e2e-tmp/clients.json",
      DRAFTS_PATH: ".e2e-tmp/drafts.json",
    },
  },
});
