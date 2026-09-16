import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkRicchiKijun } from "./ricchiKijun.js";
import { checkIppanKijun } from "./ippanKijun.js";

/**
 * 農地転用許可（立地基準・一般基準）をまとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な適格性の判断と申請書類への責任は、登録行政書士本人が負う。
 *
 * 農地転用許可の整合性チェック（建設業許可のconsistencyChecks.js相当）は
 * 本フェーズでは実装しない（docs/REQUIREMENTS_nouchi-tenyo-core.md スコープ外）。
 *
 * @param {import('./types.js').NouchiTenyoApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateNouchiTenyoEligibility(profile) {
  const checks = [checkRicchiKijun(profile.ricchiKijun), checkIppanKijun(profile.ippanKijun)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * @param {import('./types.js').NouchiTenyoApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatNouchiTenyoEligibilityReport(profile, result) {
  const lines = [
    `# 農地転用許可（農地法${profile.article}）要件判定結果 — ${profile.applicantName}`,
    "",
    "※ 本判定は自己申告データに基づく一次スクリーニングです。農地区分の最終認定・許可可否の最終判断は農業委員会・都道府県が行います。",
    "",
  ];
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
