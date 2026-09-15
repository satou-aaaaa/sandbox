/**
 * 古物商許可申請書（古物営業法施行規則様式第1号。個人用）の記載内容サマリー。
 * 対象は個人申請のみ（docs/REQUIREMENTS_kobutsu-core.md 4.6節スコープ外参照）。
 *
 * 建設業許可のyoushiki1.jsと同じ3関数パターン（resolve<様式名>Rows /
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
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveShinseishoRows(profile) {
  return [
    ["申請者氏名", orNotEntered(profile.applicantName)],
    ["申請者氏名のフリガナ", orNotEntered(profile.applicantNameKana)],
    ["住所", orNotEntered(profile.address)],
    ["電話番号", orNotEntered(profile.phoneNumber)],
    ["屋号", orNotEntered(profile.businessName)],
    ["営業所", orNotEntered(profile.eigyoshoList?.map((e) => e.officeName).join("、"))],
    ["管理者", orNotEntered(profile.eigyoshoList?.map((e) => e.managerName).join("、"))],
    ["取り扱う古物の区分", orNotEntered(profile.handledItemCategories?.join("、"))],
    ["インターネット利用の有無", profile.usesInternet ? "あり" : "なし"],
    ["URL（該当する場合）", orNotEntered(profile.url)],
  ];
}

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {Document}
 */
export function buildShinseishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("古物商許可申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveShinseishoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildShinseishoDocument(profile), outPath);
}
