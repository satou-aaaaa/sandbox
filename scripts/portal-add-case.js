/**
 * 案件（CaseRecord）を data/cases.json に登録・更新するCLI。
 *
 * 使い方:
 *   node scripts/portal-add-case.js "<caseId>" --partner-id <partnerId> --case-name "<案件名>" --received-date <受注日YYYY-MM-DD> --due-date <納期YYYY-MM-DD> --fee <報酬額> [--license-category <許可種別>] [--status 受付|作業中|納品待ち|完了|保留] [--notes "<メモ>"]
 *
 * 例:
 *   node scripts/portal-add-case.js case-001 --partner-id sample-law-office --case-name "○○様 建設業許可新規申請 書類作成" --received-date 2026-09-01 --due-date 2026-10-15 --fee 80000 --license-category construction
 */
import { upsertCase } from "../src/portal/caseStore.js";

const USAGE = [
  '使い方: node scripts/portal-add-case.js "<caseId>" --partner-id <partnerId> --case-name "<案件名>" ' +
    "--received-date <受注日YYYY-MM-DD> --due-date <納期YYYY-MM-DD> --fee <報酬額> " +
    "[--license-category <許可種別>] [--status 受付|作業中|納品待ち|完了|保留] [--notes \"<メモ>\"]",
  "同じ<caseId>を指定すると、その案件の更新になります。",
].join("\n");

const [, , caseId, ...rest] = process.argv;

/** @type {Record<string, string>} */
const options = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const value = rest[i + 1];
  if (!key || !key.startsWith("--") || value === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  options[key.slice(2)] = value;
}

const feeAmount = Number(options["fee"]);
if (
  !caseId ||
  !options["partner-id"] ||
  !options["case-name"] ||
  !options["received-date"] ||
  !options["due-date"] ||
  !options["fee"] ||
  Number.isNaN(feeAmount)
) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {import('../src/portal/types.js').CaseRecord} */
const caseRecord = {
  caseId,
  partnerId: options["partner-id"],
  caseName: options["case-name"],
  receivedDateIso: options["received-date"],
  dueDateIso: options["due-date"],
  feeAmount,
  status: /** @type {import('../src/portal/types.js').CaseRecord["status"]} */ (options["status"] ?? "受付"),
};
if (options["license-category"]) caseRecord.licenseCategory = options["license-category"];
if (options["notes"]) caseRecord.notes = options["notes"];

const cases = await upsertCase(caseRecord);
console.log(`登録しました: ${caseRecord.caseName}（caseId: ${caseId}、登録済み案件数: ${cases.length}）`);
