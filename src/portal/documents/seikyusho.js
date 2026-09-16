/**
 * 請求書の記載内容サマリー。見積書（mitsumorisho.js）と同じ理由で
 * `buildDisclaimerParagraph`は使わない（docs/DESIGN_uketsuke-portal.md 4.2節）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildLabeledTable, orNotEntered, writeDocxFile } from "../../core/documents/common.js";

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @returns {[string, string][]}
 */
export function resolveSeikyushoRows(caseRecord, partner) {
  return [
    ["請求先", orNotEntered(partner?.partnerName)],
    ["案件名", orNotEntered(caseRecord.caseName)],
    ["請求額（税別）", `${caseRecord.feeAmount.toLocaleString()}円`],
    ["受注日", orNotEntered(caseRecord.receivedDateIso)],
    ["納品日（納期）", orNotEntered(caseRecord.dueDateIso)],
  ];
}

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @returns {Document}
 */
export function buildSeikyushoDocument(caseRecord, partner) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [buildTitleHeading("請求書"), buildLabeledTable(resolveSeikyushoRows(caseRecord, partner))],
      },
    ],
  });
}

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @param {string} outPath
 */
export async function writeSeikyushoDocx(caseRecord, partner, outPath) {
  await writeDocxFile(buildSeikyushoDocument(caseRecord, partner), outPath);
}
