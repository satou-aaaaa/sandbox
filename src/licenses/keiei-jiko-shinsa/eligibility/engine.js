import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkKeieiJikoShinsaPrerequisite } from "./prerequisite.js";
import { checkInputCompleteness } from "./inputCompleteness.js";
import { checkYBunsekiStatus } from "./yStatus.js";

/**
 * 経審申請の準備状況（前提条件・入力データの完備性・Y申請状況）をまとめて
 * 確認する。建設業許可のような合否判定ではなく、産廃・民泊と同様
 * 「準備状況の可視化」が中心（docs/REQUIREMENTS_keiei-jiko-shinsa-core.md
 * FR-KJ1.6）。
 *
 * @param {import('./types.js').KeieiJikoShinsaApplicantProfile} profile
 * @param {import('../../../core/reminders/digest.js').ClientRecord} clientRecord
 *   経審は建設業許可の保有が前提条件のため、単一プロファイルではなく
 *   クライアントレコード全体を受け取る（docs/DESIGN_keiei-jiko-shinsa-core.md 4.1節）。
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateKeieiJikoShinsaReadiness(profile, clientRecord) {
  const checks = [
    checkKeieiJikoShinsaPrerequisite(profile.prerequisite, clientRecord),
    checkInputCompleteness(profile.x1, profile.x2, profile.z, profile.w),
    checkYBunsekiStatus(profile.yBunsekiStatus),
  ];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * @param {import('./types.js').KeieiJikoShinsaApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatKeieiJikoShinsaReport(profile, result) {
  const lines = [`# 経営事項審査（経審） 準備状況確認結果 — ${profile.applicantName}`, ""];
  lines.push(
    `総合判定: ${result.eligible ? "○ 準備が整っています（申請準備を進められます）" : "× 未充足の項目があります"}`,
    ""
  );
  lines.push(...formatChecksSection(result.checks));
  lines.push(
    "※ 実際の評点（X1〜W・総合評定値P）は本ツールでは計算していません。正式な評点は審査行政庁・登録経営状況分析機関の審査結果によります。"
  );
  if (!result.eligible) {
    lines.push("", "## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
