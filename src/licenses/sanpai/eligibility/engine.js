import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkSanpaiKekkaku } from "./kekkaku.js";
import { checkKoushu } from "./koushu.js";
import { checkKeiriKiso } from "./keiriKiso.js";
import { checkShisetsu } from "./shisetsu.js";

/**
 * 産業廃棄物収集運搬業許可の要件（欠格事由・講習修了・経理的基礎・
 * 運搬施設）をまとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な適格性の判断と申請書類への責任は、登録行政書士本人が負う。
 *
 * @param {import('./types.js').SanpaiApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateSanpaiEligibility(profile) {
  const checks = [
    checkSanpaiKekkaku(profile.kekkaku),
    checkKoushu(profile.koushu),
    checkKeiriKiso(profile.keiriKiso),
    checkShisetsu(profile.hasOdorSpillPreventionMeasures),
  ];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ用）。
 * @param {import('./types.js').SanpaiApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatSanpaiEligibilityReport(profile, result) {
  const lines = [`# 産業廃棄物収集運搬業許可 要件判定結果 — ${profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
