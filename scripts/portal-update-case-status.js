/**
 * 案件のステータスのみを更新するCLI（進捗更新用の簡易ラッパー）。
 * ステータス遷移に厳密な制約は設けない（差し戻し等、逆順の変更もありうるため。
 * docs/REQUIREMENTS_uketsuke-portal.md FR-U1.4）。
 *
 * 使い方:
 *   node scripts/portal-update-case-status.js "<caseId>" <受付|作業中|納品待ち|完了|保留> [完了日YYYY-MM-DD]
 *
 * ステータスを「完了」にする際、完了日を省略すると本日の日付を自動設定する
 * （月次請求サマリーの絞り込みに使うため。FR-U2.3）。完了以外のステータスに
 * 変更する場合、完了日引数は無視される。
 */
import { loadCases, upsertCase } from "../src/portal/caseStore.js";

const USAGE =
  '使い方: node scripts/portal-update-case-status.js "<caseId>" <受付|作業中|納品待ち|完了|保留> [完了日YYYY-MM-DD]';
const VALID_STATUSES = ["受付", "作業中", "納品待ち", "完了", "保留"];

const [, , caseId, status, completedDateArg] = process.argv;

if (!caseId || !status || !VALID_STATUSES.includes(status)) {
  console.error(USAGE);
  console.error(`ステータスは次のいずれかを指定してください: ${VALID_STATUSES.join("、")}`);
  process.exit(1);
}

const cases = await loadCases();
const target = cases.find((c) => c.caseId === caseId);
if (!target) {
  console.error(`案件が見つかりません: ${caseId}`);
  process.exit(1);
}

/** @type {import('../src/portal/types.js').CaseRecord} */
const updated = { ...target, status: /** @type {import('../src/portal/types.js').CaseRecord["status"]} */ (status) };
if (status === "完了") {
  updated.completedDateIso = completedDateArg || new Date().toISOString().slice(0, 10);
}

await upsertCase(updated);
console.log(
  `更新しました: ${target.caseName}（caseId: ${caseId}） → ステータス: ${status}` +
    (updated.completedDateIso ? `、完了日: ${updated.completedDateIso}` : "")
);
