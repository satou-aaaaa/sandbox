/**
 * 経営規模等評価申請書の記載内容サマリー。X1・X2・Z・Wの入力内容を
 * 表形式で整理するのみで、評点は出力しない（docs/DESIGN_keiei-jiko-shinsa-core.md
 * 1章の設計原則）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildLabeledTable, orNotEntered, writeDocxFile } from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveKeieikiboHyoukaRows(profile) {
  return [
    ["申請者名", orNotEntered(profile.applicantName)],
    ["経審を受ける業種区分", orNotEntered(profile.prerequisite?.targetGyoshu?.join("、"))],
    [
      "X1: 完成工事高（直近実績。参考値）",
      orNotEntered(profile.x1?.annualCompletedWorkAmounts?.length ? `${profile.x1.annualCompletedWorkAmounts.map((a) => a.toLocaleString()).join("円 / ")}円` : undefined),
    ],
    ["X2: 自己資本額", orNotEntered(profile.x2?.latestNetAssets != null ? `${profile.x2.latestNetAssets.toLocaleString()}円` : undefined)],
    ["Z: 技術職員数（資格区分別）", orNotEntered(profile.z?.technicalStaff?.map((t) => `${t.qualification}: ${t.count}名`).join("、"))],
    ["W: 社会保険加入状況", profile.w?.isSocialInsuranceEnrolled ? "加入済み" : "未加入（要確認）"],
  ];
}

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @returns {Document}
 */
export function buildKeieikiboHyoukaDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("経営規模等評価申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveKeieikiboHyoukaRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeKeieikiboHyoukaDocx(profile, outPath) {
  await writeDocxFile(buildKeieikiboHyoukaDocument(profile), outPath);
}
