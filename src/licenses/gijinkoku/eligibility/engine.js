import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkGakureki } from "./gakureki.js";
import { checkHoshu } from "./hoshu.js";
import { checkKanrensei } from "./kanrensei.js";
import { GIJINKOKU_SCREENING_NOTICE } from "./disclaimer.js";

/**
 * 在留資格「技術・人文知識・国際業務」の要件（学歴・実務経験・報酬・
 * 専攻職務関連性）をまとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な該当性は出入国在留管理局が個別に審査する（1.3節・NFR-G2）。
 *
 * @param {import('./types.js').GijinkokuApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateGijinkokuEligibility(profile) {
  const checks = [checkGakureki(profile.gakureki), checkHoshu(profile.hoshu), checkKanrensei(profile.kanrensei)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * 他モジュールの`formatEligibilityReport`をコピーせず、コアの共通部分＋
 * 本モジュール固有の強調文言（`GIJINKOKU_SCREENING_NOTICE`）という構成で
 * 実装する（docs/DESIGN_gijinkoku-core.md 4.2節）。
 *
 * @param {import('./types.js').GijinkokuApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatGijinkokuEligibilityReport(profile, result) {
  const lines = [`# 在留資格「技術・人文知識・国際業務」要件判定結果 — ${profile.applicantName}`, ""];
  lines.push(GIJINKOKU_SCREENING_NOTICE, "");
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
    lines.push("");
  }
  lines.push(GIJINKOKU_SCREENING_NOTICE);
  return lines.join("\n").trimEnd();
}
