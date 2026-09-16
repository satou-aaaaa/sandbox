/**
 * 農地転用許可申請書（4条・5条共通の記載事項を中心とする）の記載内容サマリー。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildLabeledTable, orNotEntered, writeDocxFile } from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').NouchiTenyoApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveShinseishoRows(profile) {
  /** @type {[string, string][]} */
  const rows = [
    ["適用条文", `農地法${profile.article}`],
    ["申請者氏名（法人名）", orNotEntered(profile.applicantName)],
    ["住所", orNotEntered(profile.address)],
    ["転用対象農地の所在地", orNotEntered(profile.landAddress)],
    ["転用対象農地の面積", profile.landAreaSqm != null ? `${profile.landAreaSqm}平方メートル` : "（未入力）"],
    ["転用の目的", orNotEntered(profile.purposeOfConversion)],
    ["農地区分", orNotEntered(profile.ricchiKijun?.nouchiKubun)],
  ];
  if (profile.article === "5条") {
    rows.push(["譲受人・借主氏名", orNotEntered(profile.rightsHolderName)]);
  }
  return rows;
}

/**
 * @param {import('../eligibility/types.js').NouchiTenyoApplicantProfile} profile
 * @returns {Document}
 */
export function buildShinseishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`農地転用許可申請書 — 申請内容サマリー（農地法${profile.article}）`),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveShinseishoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').NouchiTenyoApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildShinseishoDocument(profile), outPath);
}
