import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkShisetsuKijun } from "./shisetsuKijun.js";
import { checkSekininsha } from "./sekininsha.js";
import { HACCP_CONTINUING_OBLIGATION_NOTICE } from "./disclaimer.js";

/**
 * 飲食店営業許可の要件（施設基準・食品衛生責任者の設置）をまとめて判定する。
 * HACCPに沿った衛生管理は許可要件ではないため判定対象に含めない
 * （disclaimer.js参照）。
 *
 * @param {import('./types.js').InshokutenApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateInshokutenEligibility(profile) {
  const checks = [checkShisetsuKijun(profile.shisetsu), checkSekininsha(profile.sekininsha)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * @param {import('./types.js').InshokutenApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatInshokutenEligibilityReport(profile, result) {
  const lines = [`# 飲食店営業許可 要件判定結果 — ${profile.businessName ?? profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 施設基準・食品衛生責任者の要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
    lines.push("");
  }
  lines.push(HACCP_CONTINUING_OBLIGATION_NOTICE);
  return lines.join("\n").trimEnd();
}
