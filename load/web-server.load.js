/**
 * 負荷テスト（autocannon）。
 *
 * 【なぜ導入したか】本ツールは現状「発注者本人がローカルで動かす」単一利用者
 * ツールだが、将来的にローカル限定ではなくなる可能性がある（複数拠点・
 * 複数顧客が同時にアクセスする形態への発展等）という前提の変化を踏まえ、
 * 「同時に複数リクエストが来ても壊れずに応答できるか」の最低限のベースラインを
 * 今のうちに確立しておく。現時点で具体的な性能要件（目標レイテンシ・スループット）
 * は存在しないため、厳密な閾値判定（例: 「p99レイテンシが100ms以内」）は
 * 行わず、「同時リクエスト下でエラー・タイムアウト・5xxが発生しないこと」を
 * 確認する疎通レベルのテストに留める。将来、実際の利用形態が固まった時点で
 * 具体的な性能目標値を追加することを推奨する。
 *
 * 【なぜ node --test の対象外か】autocannonは`node --test`のテストではなく
 * 独立したベンチマークスクリプトとして実行する（実行時間が数秒〜数十秒かかり、
 * CPU負荷も高くなるため、通常のユニットテスト実行やCIの必須ゲートには含めない。
 * ミューテーションテスト・E2Eテストと同じく「大きな変更の節目で手動実行する」
 * 位置づけ）。
 *
 * 実行方法: npm run test:load
 */
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import autocannon from "autocannon";
import { createServer } from "../src/web/server.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

async function startTestServer() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-load-test-"));
  const outDir = path.join(tmpDir, "out");
  const clientsPath = path.join(tmpDir, "clients.json");
  const draftsPath = path.join(tmpDir, "drafts.json");
  const server = createServer({ outDir, clientsPath, draftsPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      // 負荷テストで短時間に大量のdocxファイルを生成した直後は、Windows環境で
      // ファイルハンドルの解放（ウイルス対策ソフトのスキャン等）がわずかに
      // 遅れ、rmが ENOTEMPTY で失敗することがある（Node.js公式ドキュメントが
      // 明記している既知の事象）。maxRetries/retryDelayで自動リトライする。
      await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

/**
 * @param {string} label
 * @param {import('autocannon').Options} opts
 */
async function runScenario(label, opts) {
  console.log(`\n=== ${label} ===`);
  const result = await autocannon({
    connections: 10, // 同時アクセス数。個人利用ツールの実際の利用規模から見て十分な負荷（本番Webサービス想定の数百〜数千接続ではない）
    duration: 5, // 秒。ローカル/CIでの実行時間を抑えるため短めに設定
    ...opts,
  });
  console.log(autocannon.printResult(result));
  return result;
}

/** @param {import('autocannon').Result} result @param {string} label */
function assertNoFailures(result, label) {
  assert.equal(result.errors, 0, `${label}: エラーが発生しました`);
  assert.equal(result.timeouts, 0, `${label}: タイムアウトが発生しました`);
  assert.equal(result.non2xx, 0, `${label}: 2xx以外のレスポンスがありました`);
}

const ctx = await startTestServer();
try {
  const getResult = await runScenario("GET / （インテイクフォーム表示）", { url: `${ctx.baseUrl}/` });
  assertNoFailures(getResult, "GET /");

  const profile = buildSampleApplicantProfile();
  const body = new URLSearchParams({ profileJson: JSON.stringify(profile) }).toString();
  const submitResult = await runScenario("POST /submit （要件判定＋書類生成）", {
    url: `${ctx.baseUrl}/submit`,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  assertNoFailures(submitResult, "POST /submit");

  console.log("\n負荷テスト: 同時リクエスト下でのエラー・タイムアウト・5xxは発生しませんでした。");
} finally {
  await ctx.close();
}
