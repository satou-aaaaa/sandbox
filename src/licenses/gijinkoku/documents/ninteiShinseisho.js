/**
 * 在留資格認定証明書交付申請書の記載内容サマリー。
 *
 * 他モジュールと同じ3関数パターン（resolve<様式名>Rows / build<様式名>Document /
 * write<様式名>Docx）を踏襲するが、`buildDisclaimerParagraph`の直後に
 * 本モジュール専用の一次スクリーニング強調文言（NFR-G2）も併記する
 * （docs/DESIGN_gijinkoku-core.md 4.2節）。
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
import { GIJINKOKU_SCREENING_NOTICE } from "../eligibility/disclaimer.js";

/**
 * @param {import('../eligibility/types.js').GijinkokuApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveNinteiShinseishoRows(profile) {
  return [
    ["外国人本人の氏名", orNotEntered(profile.applicantName)],
    ["国籍", orNotEntered(profile.nationality)],
    ["所属機関（受入企業）名", orNotEntered(profile.companyName)],
    ["所属機関カテゴリー", profile.companyCategory ? `カテゴリー${profile.companyCategory}` : "（未確定）"],
    ["従事する職務内容", orNotEntered(profile.kanrensei?.jobDescription)],
    ["提示年収", `${profile.hoshu.offeredSalaryAnnual.toLocaleString()}円`],
  ];
}

/**
 * @param {import('../eligibility/types.js').GijinkokuApplicantProfile} profile
 * @returns {Document}
 */
export function buildNinteiShinseishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("在留資格認定証明書交付申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          ...buildBulletList("重要な注意事項", [GIJINKOKU_SCREENING_NOTICE], { warning: true }),
          buildLabeledTable(resolveNinteiShinseishoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').GijinkokuApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeNinteiShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildNinteiShinseishoDocument(profile), outPath);
}
