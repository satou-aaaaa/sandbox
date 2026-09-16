import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkMinpakuKekkaku } from "./kekkaku.js";
import { checkDocumentChecklist } from "./documentChecklist.js";
import { checkResidentType } from "./residentType.js";

/**
 * 住宅宿泊事業（民泊）届出の準備状況（欠格事由・必要書類・家主居住/不在型の
 * 別）をまとめて確認する。届出制のため、建設業許可等のような裁量的な
 * 合否判定ではなく「届出の準備が整っているか」の確認という位置づけ
 * （docs/REQUIREMENTS_minpaku-core.md 1.2節）。
 *
 * @param {import('./types.js').MinpakuApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateMinpakuEligibility(profile) {
  const checks = [
    checkMinpakuKekkaku(profile.kekkaku),
    checkDocumentChecklist(profile.requiredDocuments),
    checkResidentType(profile.residentType, profile.managementCompanyName),
  ];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * @param {import('./types.js').MinpakuApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatMinpakuEligibilityReport(profile, result) {
  const lines = [`# 住宅宿泊事業（民泊）届出 準備状況確認結果 — ${profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 準備が整っています（届出準備を進められます）" : "× 未充足の項目があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
