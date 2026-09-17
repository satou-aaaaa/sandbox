/**
 * data/cases.json・data/partners.jsonに登録済みの案件から、指定した元請
 * 行政書士・対象年月の月次請求サマリー（FR-U2.3）をdocxで生成するCLI。
 *
 * 使い方:
 *   node scripts/portal-monthly-seikyusho.js "<partnerId>" <対象年月YYYY-MM> [出力先パス]
 *
 * 「当月完了分」は`status === "完了"`かつ`completedDateIso`が対象年月の
 * 案件のみを対象とする（`portal-update-case-status.js`で完了に更新する際に
 * 完了日が自動記録される）。
 */
import { loadCases, loadPartners } from "../src/portal/caseStore.js";
import { filterCompletedCasesForMonth, writeMonthlySeikyushoDocx } from "../src/portal/documents/monthlySeikyusho.js";

const USAGE = '使い方: node scripts/portal-monthly-seikyusho.js "<partnerId>" <対象年月YYYY-MM> [出力先パス]';

const [, , partnerId, yearMonth, outPathArg] = process.argv;

if (!partnerId || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
  console.error(USAGE);
  process.exit(1);
}

const [cases, partners] = await Promise.all([loadCases(), loadPartners()]);
const partner = partners.find((p) => p.partnerId === partnerId);
if (!partner) {
  console.error(`元請行政書士が見つかりません: ${partnerId}`);
  process.exit(1);
}

const completedCases = filterCompletedCasesForMonth(cases, partnerId, yearMonth);
const outPath = outPathArg || `out/portal-monthly-seikyusho-${partnerId}-${yearMonth}.docx`;
await writeMonthlySeikyushoDocx(completedCases, partner, yearMonth, outPath);

console.log(
  `生成しました: ${outPath}（${partner.partnerName} 様、${yearMonth}分、${completedCases.length}件、` +
    `合計${completedCases.reduce((sum, c) => sum + c.feeAmount, 0).toLocaleString()}円）`
);
