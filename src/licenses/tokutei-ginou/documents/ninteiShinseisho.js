/**
 * 在留資格認定証明書交付申請書の記載内容サマリー。
 *
 * 他モジュールと同じ3関数パターン（resolve<様式名>Rows / build<様式名>Document /
 * write<様式名>Docx）を踏襲するが、`buildDisclaimerParagraph`の直後に
 * 本モジュール専用の一次スクリーニング強調文言（NFR-T2）も併記する
 * （gijinkoku-coreのninteiShinseisho.jsと同型）。
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
import { TOKUTEI_GINOU_SCREENING_NOTICE } from "../eligibility/disclaimer.js";
import { getField } from "../eligibility/fieldRegistry.js";

/**
 * @param {import('../eligibility/types.js').TokuteiGinouApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveNinteiShinseishoRows(profile) {
  const field = getField(profile.ginouShiken.fieldKey);
  return [
    ["外国人本人の氏名", orNotEntered(profile.applicantName)],
    ["国籍", orNotEntered(profile.nationality)],
    ["特定産業分野", orNotEntered(field?.fieldLabel ?? profile.ginouShiken.fieldKey)],
    ["特定技能所属機関名", orNotEntered(profile.shozokuKikanKijun?.companyName)],
    ["従事する職務内容", orNotEntered(profile.jobDescription)],
    ["提示年収", `${profile.shozokuKikanKijun.offeredSalaryAnnual.toLocaleString()}円`],
    ["支援計画の実施方法", orNotEntered(profile.shienTaisei?.shienMethod)],
  ];
}

/**
 * @param {import('../eligibility/types.js').TokuteiGinouApplicantProfile} profile
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
          ...buildBulletList("重要な注意事項", [TOKUTEI_GINOU_SCREENING_NOTICE], { warning: true }),
          buildLabeledTable(resolveNinteiShinseishoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').TokuteiGinouApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeNinteiShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildNinteiShinseishoDocument(profile), outPath);
}
