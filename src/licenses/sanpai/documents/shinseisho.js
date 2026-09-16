/**
 * 産業廃棄物収集運搬業許可申請書の記載内容サマリー。
 *
 * 建設業許可・古物商許可と同じ3関数パターン（resolve<様式名>Rows /
 * build<様式名>Document / write<様式名>Docx）を踏襲する。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').SanpaiApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveShinseishoRows(profile) {
  return [
    ["申請者氏名（法人名）", orNotEntered(profile.applicantName)],
    ["代表者氏名", orNotEntered(profile.representativeName)],
    ["住所", orNotEntered(profile.address)],
    ["活動予定の都道府県", orNotEntered(profile.prefecture)],
    ["取り扱う産業廃棄物の種類", orNotEntered(profile.wasteTypes?.join("、"))],
    ["講習修了証発行日", orNotEntered(profile.koushu?.completionDateIso)],
    ["申請予定日", orNotEntered(profile.koushu?.plannedApplicationDateIso)],
  ];
}

/**
 * @param {import('../eligibility/types.js').SanpaiApplicantProfile} profile
 * @returns {Document}
 */
export function buildShinseishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("産業廃棄物収集運搬業許可申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveShinseishoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').SanpaiApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildShinseishoDocument(profile), outPath);
}
