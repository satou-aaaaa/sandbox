import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkGinouSuijun } from "./ginouSuijun.js";
import { checkNihongoNouryoku } from "./nihongoNouryoku.js";
import { checkShozokuKikanKijun } from "./shozokuKikanKijun.js";
import { checkShienTaisei } from "./shienTaisei.js";
import { TOKUTEI_GINOU_SCREENING_NOTICE } from "./disclaimer.js";

/**
 * 特定技能1号の要件（本人の技能・日本語水準、受入れ機関の基準、支援体制）を
 * まとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な該当性は出入国在留管理局・分野所管省庁が個別に審査する（1.3節・NFR-T2）。
 *
 * @param {import('./types.js').TokuteiGinouApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateTokuteiGinouEligibility(profile) {
  const checks = [
    checkGinouSuijun(profile.ginouShiken),
    checkNihongoNouryoku(profile.nihongoNouryoku, profile.ginouShiken.fieldKey),
    checkShozokuKikanKijun(profile.shozokuKikanKijun),
    checkShienTaisei(profile.shienTaisei),
  ];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * gijinkoku-coreのformatGijinkokuEligibilityReportと同じ構成
 * （コアの共通部分＋本モジュール固有の強調文言）で実装する。
 *
 * @param {import('./types.js').TokuteiGinouApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatTokuteiGinouEligibilityReport(profile, result) {
  const lines = [`# 特定技能1号 要件判定結果 — ${profile.applicantName}`, ""];
  lines.push(TOKUTEI_GINOU_SCREENING_NOTICE, "");
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
    lines.push("");
  }
  lines.push(TOKUTEI_GINOU_SCREENING_NOTICE);
  return lines.join("\n").trimEnd();
}
