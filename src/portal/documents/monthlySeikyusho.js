/**
 * 月次請求サマリー（FR-U2.3）: 1つの元請行政書士に対する「当月完了分」の
 * 案件をまとめて一覧化し、合計金額を算出する。任意機能（優先度は
 * 見積書・請求書〈個別案件単位〉より低い。docs/REQUIREMENTS_uketsuke-portal.md
 * 4.2節）。
 *
 * 「当月完了分」の絞り込みは`CaseRecord.status === "完了"`かつ
 * `completedDateIso`が対象年月（YYYY-MM）で始まる案件とする。`dueDateIso`
 * （納期）はあくまで予定日であり実際の完了日と一致しないことがあるため、
 * 絞り込みには使わない（`completedDateIso`のJSDoc参照）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildHeaderedTable, buildBulletList, writeDocxFile } from "../../core/documents/common.js";

/**
 * 指定した元請行政書士・対象年月に該当する「完了済み」案件を抽出する。
 * @param {import('../types.js').CaseRecord[]} cases
 * @param {string} partnerId
 * @param {string} yearMonth 対象年月（YYYY-MM）
 * @returns {import('../types.js').CaseRecord[]}
 */
export function filterCompletedCasesForMonth(cases, partnerId, yearMonth) {
  return cases.filter((c) => c.partnerId === partnerId && c.status === "完了" && c.completedDateIso?.startsWith(yearMonth));
}

/**
 * @param {import('../types.js').CaseRecord[]} cases 対象案件（filterCompletedCasesForMonthの結果を渡す）
 * @returns {{ headers: string[], rows: string[][], totalFeeAmount: number }}
 */
export function resolveMonthlySeikyushoTable(cases) {
  const headers = ["案件名", "完了日", "報酬額（税別）"];
  const rows = cases.map((c) => [c.caseName, c.completedDateIso ?? "", `${c.feeAmount.toLocaleString()}円`]);
  const totalFeeAmount = cases.reduce((sum, c) => sum + c.feeAmount, 0);
  return { headers, rows, totalFeeAmount };
}

/**
 * @param {import('../types.js').CaseRecord[]} cases 対象案件（filterCompletedCasesForMonthの結果を渡す）
 * @param {import('../types.js').PartnerRecord} partner
 * @param {string} yearMonth 対象年月（YYYY-MM）
 * @returns {Document}
 */
export function buildMonthlySeikyushoDocument(cases, partner, yearMonth) {
  const { headers, rows, totalFeeAmount } = resolveMonthlySeikyushoTable(cases);
  const warnings = cases.length === 0 ? [`${yearMonth}に完了と記録された案件が見つかりませんでした。`] : [];
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`${partner.partnerName} 様 — ${yearMonth}分 月次請求サマリー`),
          buildHeaderedTable(headers, rows.length > 0 ? rows : [["（該当案件なし）", "", ""]]),
          ...buildBulletList("合計", [`合計請求額（税別）: ${totalFeeAmount.toLocaleString()}円（${cases.length}件）`]),
          ...buildBulletList("確認事項", warnings, { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').CaseRecord[]} cases
 * @param {import('../types.js').PartnerRecord} partner
 * @param {string} yearMonth
 * @param {string} outPath
 */
export async function writeMonthlySeikyushoDocx(cases, partner, yearMonth, outPath) {
  await writeDocxFile(buildMonthlySeikyushoDocument(cases, partner, yearMonth), outPath);
}
