/**
 * 略歴書の記載内容サマリー。
 * 過去5年分程度の職歴・経歴（自由記述）を本文段落として出力する。
 */
import { Document, Paragraph, TextRun } from "docx";
import {
  FONT,
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildSubHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveRirekishoRows(profile) {
  return [
    ["申請者氏名", orNotEntered(profile.applicantName)],
    ["生年月日", orNotEntered(profile.birthDate)],
    ["住所", orNotEntered(profile.address)],
  ];
}

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {Document}
 */
export function buildRirekishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("略歴書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveRirekishoRows(profile)),
          buildSubHeading("略歴（過去5年分が目安）"),
          new Paragraph({
            children: [new TextRun({ text: orNotEntered(profile.representativeHistory), font: FONT, size: 20 })],
          }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeRirekishoDocx(profile, outPath) {
  await writeDocxFile(buildRirekishoDocument(profile), outPath);
}
