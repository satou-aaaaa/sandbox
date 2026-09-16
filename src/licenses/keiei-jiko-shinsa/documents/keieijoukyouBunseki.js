/**
 * 経営状況分析申請書の記載内容サマリー。実際の申請先は登録経営状況分析
 * 機関（複数存在）であり、本モジュールはどの機関を選ぶかの比較・推奨は
 * 行わない（docs/REQUIREMENTS_keiei-jiko-shinsa-core.md FR-KJ2.2）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildLabeledTable, orNotEntered, writeDocxFile } from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveKeieijoukyouBunsekiRows(profile) {
  return [
    ["申請者名", orNotEntered(profile.applicantName)],
    ["自己資本額（貸借対照表の純資産合計）", orNotEntered(profile.x2?.latestNetAssets != null ? `${profile.x2.latestNetAssets.toLocaleString()}円` : undefined)],
    ["利払前利益の平均額", orNotEntered(profile.x2?.averageProfitBeforeInterest != null ? `${profile.x2.averageProfitBeforeInterest.toLocaleString()}円` : undefined)],
    ["元請完成工事高の平均額", orNotEntered(profile.z?.averageDirectContractCompletedWorkAmount != null ? `${profile.z.averageDirectContractCompletedWorkAmount.toLocaleString()}円` : undefined)],
    ["経営状況分析（Y）の申請状況", orNotEntered(profile.yBunsekiStatus)],
  ];
}

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @returns {Document}
 */
export function buildKeieijoukyouBunsekiDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("経営状況分析申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveKeieijoukyouBunsekiRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeKeieijoukyouBunsekiDocx(profile, outPath) {
  await writeDocxFile(buildKeieijoukyouBunsekiDocument(profile), outPath);
}
