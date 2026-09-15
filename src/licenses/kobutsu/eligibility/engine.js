import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkKobutsuKekkaku } from "./kekkaku.js";
import { checkKobutsuEigyosho } from "./eigyosho.js";

/**
 * 古物商許可の要件（欠格事由・営業所/管理者要件）をまとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な適格性の判断と申請書類への責任は、登録行政書士本人が負う。
 *
 * 古物商許可の整合性チェック（建設業許可のconsistencyChecks.js相当）は
 * 本フェーズでは実装しない（docs/REQUIREMENTS_kobutsu-core.md 4.6節スコープ外）。
 *
 * @param {import('./types.js').KobutsuApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateKobutsuEligibility(profile) {
  const checks = [checkKobutsuKekkaku(profile.kekkaku), checkKobutsuEigyosho(profile.eigyoshoList)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * @param {import('./types.js').KobutsuApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatKobutsuEligibilityReport(profile, result) {
  const lines = [`# 古物商許可 要件判定結果 — ${profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
