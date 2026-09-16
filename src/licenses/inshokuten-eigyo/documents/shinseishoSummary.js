/**
 * 飲食店営業許可申請書の記載内容サマリー（FR-I2.1）。
 * 他モジュールと同じ3関数パターン（resolve<様式名>Rows / build<様式名>Document /
 * write<様式名>Docx）を踏襲する。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";
import { HACCP_CONTINUING_OBLIGATION_NOTICE } from "../eligibility/disclaimer.js";

/**
 * @param {import('../eligibility/types.js').InshokutenApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveShinseishoSummaryRows(profile) {
  return [
    ["申請者（営業者）氏名", orNotEntered(profile.applicantName)],
    ["屋号", orNotEntered(profile.businessName)],
    ["営業所所在地", orNotEntered(profile.storeAddress)],
    ["管轄自治体（保健所）", orNotEntered(profile.municipalityName)],
    ["食品衛生責任者", orNotEntered(profile.sekininsha?.name)],
    ["資格の種別", orNotEntered(profile.sekininsha?.qualificationType)],
    ["開業予定日", orNotEntered(profile.plannedOpeningDateIso)],
  ];
}

/**
 * @param {import('../eligibility/types.js').InshokutenApplicantProfile} profile
 * @returns {Document}
 */
export function buildShinseishoSummaryDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("飲食店営業許可申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveShinseishoSummaryRows(profile)),
          ...buildBulletList("重要な注意事項", [HACCP_CONTINUING_OBLIGATION_NOTICE], { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').InshokutenApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeShinseishoSummaryDocx(profile, outPath) {
  await writeDocxFile(buildShinseishoSummaryDocument(profile), outPath);
}
