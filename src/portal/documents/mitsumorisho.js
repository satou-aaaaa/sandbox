/**
 * 見積書の記載内容サマリー。
 *
 * 【注意】既存の許可種別モジュールと異なり、`buildDisclaimerParagraph`
 * （「正式提出様式ではない」注記）は使わない。見積書は国や自治体が定める
 * 「様式」ではなく発注者自身が作成する書類であり、免責注記の対象には
 * ならないため（docs/DESIGN_uketsuke-portal.md 4.2節）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildLabeledTable, orNotEntered, writeDocxFile } from "../../core/documents/common.js";

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @returns {[string, string][]}
 */
export function resolveMitsumorishoRows(caseRecord, partner) {
  return [
    ["宛先", orNotEntered(partner?.partnerName)],
    ["案件名", orNotEntered(caseRecord.caseName)],
    ["報酬額（税別）", `${caseRecord.feeAmount.toLocaleString()}円`],
    ["納期", orNotEntered(caseRecord.dueDateIso)],
  ];
}

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @returns {Document}
 */
export function buildMitsumorishoDocument(caseRecord, partner) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [buildTitleHeading("見積書"), buildLabeledTable(resolveMitsumorishoRows(caseRecord, partner))],
      },
    ],
  });
}

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @param {string} outPath
 */
export async function writeMitsumorishoDocx(caseRecord, partner, outPath) {
  await writeDocxFile(buildMitsumorishoDocument(caseRecord, partner), outPath);
}
