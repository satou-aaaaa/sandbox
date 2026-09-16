/**
 * ミューテーションテスト（Stryker Mutator）の設定。
 *
 * 【なぜ導入したか】
 * `npm run test:coverage`（行・分岐カバレッジ）は「そのコードが実行されたか」しか
 * 教えてくれない。実行されていても、テストの assert が緩い・不足していれば
 * バグを見逃す（例: `>=` を `>` に書き換えても既存テストが気づかない、等）。
 * ミューテーションテストはソースコードに機械的に小さなバグ（ミュータント。
 * 例: `>=`→`>`、`&&`→`||`、`true`→`false`）を1箇所ずつ注入し、既存の
 * `npm test` がそれを検知して失敗するか（＝ミュータントを「殺せた」か）を
 * 全ミュータントについて確認する。生き残った（テストが検知できなかった）
 * ミュータントは、その箇所のテストの assert が不十分であることを示す
 * 具体的な手がかりになる。
 *
 * 【なぜ command runner か】
 * このプロジェクトはビルドレス構成（TypeScriptコンパイルなし、素の
 * JavaScript + node:test）を採用しており、Stryker公式のJest/Vitest/Mocha等の
 * 専用テストランナー統合は使えない。汎用の`command`ランナー（指定した
 * コマンドを実行し、終了コードで成否を判定するだけの仕組み）を使うことで、
 * `npm test`（node --test）をそのまま流用できる。
 * 【トレードオフ】command runnerは`coverageAnalysis: "off"`にする必要があり
 * （Stryker側でテストとソースの対応関係を把握できないため）、ミュータント
 * 1件ごとに全テストを再実行する。テスト自体は高速（292件で約1.5秒）だが、
 * ミュータント数（数百件規模）× プロセス起動オーバーヘッドがかかるため、
 * 実行には数分〜数十分かかる（`npm run test`のような秒単位では終わらない）。
 * 日常のPRごとに毎回実行するものではなく、大きな変更の節目やテスト方針の
 * 見直し時に手動で実行し、生き残ったミュータントを確認する運用を想定する。
 *
 * 参照: https://stryker-mutator.io/docs/stryker-js/configuration/
 */
export default {
  $schema: "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  packageManager: "npm",
  testRunner: "command",
  commandRunner: {
    // npmラッパー分のオーバーヘッドを避けるため、npm test ではなく直接node --testを呼ぶ。
    command: "node --test",
  },
  coverageAnalysis: "off",
  // 【既知の問題】このリポジトリのtsconfig.json（ADR-0007のJSDoc型チェック用。
  // ビルドには使わない）が存在すると、Stryker（9系・10系とも）が内部で
  // `ts.parseConfigFileTextToJson` を呼ぶが、`typescript@7`系ではこのAPIが
  // 削除されており即座にクラッシュする（Stryker-JS側の既知の非互換）。
  // 本プロジェクトはStrykerのtypescript-checkerプラグインを使わない
  // （command runnerのみ）ため、存在しないパスを指定してこの前処理自体を
  // スキップする（公式な回避策はまだ提供されていないため暫定対応）。
  tsconfigFile: "stryker-skip-tsconfig.json",
  // 【対象範囲についての判断】全ソース（43ファイル・2007ミュータント）を
  // 対象にすると、command runner（coverageAnalysis: "off"のためミュータント
  // 1件ごとに全テストを再実行する）では実行に1時間以上かかり非現実的
  // だったため、「間違えると実害が大きい」ロジック（要件判定・欠格事由判定・
  // 日付/金額計算・CSV相互変換）に絞る。以下は意図的に対象外:
  // - src/documents/**・src/licenses/*/documents/**（様式サマリーの行組み立て。
  //   文字列ラベルの置換など「等価ミュータント」が多く、既にbranch coverage
  //   拡充で個別入力の網羅は済んでいるため費用対効果が低い）
  // - src/web/**（HTML文字列テンプレート。同上の理由に加え、
  //   test/pageRendering.test.js・web.test.jsで個別に検証済み）
  // - src/core/documents/common.js（docx共通ヘルパー。同上）
  // - scripts/**（CLI引数解析のみの薄いエントリポイントで直接テストを持たない）
  mutate: [
    "src/core/eligibility/**/*.js",
    "src/core/reminders/**/*.js",
    "src/licenses/construction/eligibility/**/*.js",
    "src/licenses/construction/reminders/**/*.js",
    "src/licenses/construction/index.js",
    "src/licenses/kobutsu/eligibility/**/*.js",
    "src/licenses/kobutsu/reminders/**/*.js",
    "src/licenses/kobutsu/index.js",
    "src/core/reminders/expirySchedule.js",
    "src/licenses/sanpai/eligibility/**/*.js",
    "src/licenses/sanpai/reminders/**/*.js",
    "src/licenses/sanpai/index.js",
    "src/licenses/minpaku/eligibility/**/*.js",
    "src/licenses/minpaku/reminders/**/*.js",
    "src/licenses/minpaku/index.js",
    "src/portal/reminders/caseDeadlines.js",
    "src/licenses/gijinkoku/eligibility/**/*.js",
    "src/licenses/gijinkoku/reminders/**/*.js",
    "src/licenses/gijinkoku/index.js",
    "src/licenses/keiei-jiko-shinsa/eligibility/**/*.js",
    "src/licenses/keiei-jiko-shinsa/reminders/**/*.js",
    "src/licenses/keiei-jiko-shinsa/index.js",
    "src/licenses/nouchi-tenyo/eligibility/**/*.js",
    "src/licenses/nouchi-tenyo/reminders/**/*.js",
    "src/licenses/nouchi-tenyo/index.js",
  ],
  // ignoreStatic は coverageAnalysis: "off"（command runner使用時の制約）と
  // 併用できないため設定しない。静的に一度しか評価されない箇所のミュータントも
  // 律儀に全テスト実行で判定されるが、正確性を優先する。
  concurrency: 6,
  timeoutMS: 15000,
  reporters: ["progress", "clear-text", "html"],
  htmlReporter: {
    fileName: "reports/mutation/mutation.html",
  },
  thresholds: {
    // 初回導入時点のベースラインが確定するまでは、しきい値未達でCIを
    // 落とさない（break: null）。ベースライン計測後、docs/DEVELOPMENT_GUIDE.md
    // に記録した実測値をもとに調整すること。
    high: 90,
    low: 70,
    break: null,
  },
};
