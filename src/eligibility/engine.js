import { checkKeieiGyomuKanri } from "./rules/keieiGyomuKanri.js";
import { checkSenninGijutsusha } from "./rules/senninGijutsusha.js";
import { checkZaisanKiso } from "./rules/zaisanKiso.js";
import { checkKekkaku } from "./rules/kekkaku.js";
import { checkSeijitsusei } from "./rules/seijitsusei.js";

/**
 * 建設業許可の法定5要件をまとめて判定する。
 *
 * 判定結果はあくまで「申請前のセルフチェック・要件充足の一次スクリーニング」であり、
 * 最終的な適格性の判断と申請書類への責任は、登録行政書士本人が負う。
 * ここで eligible=true が出ても、それは「自動的に許可される」ことを意味しない。
 *
 * @param {import('./types.js').ApplicantProfile} profile
 * @returns {import('./types.js').EligibilityResult}
 */
export function evaluateEligibility(profile) {
  const checks = [
    checkKeieiGyomuKanri(profile.keieiGyomuKanri),
    checkSenninGijutsusha(profile.senninGijutsushaList),
    checkZaisanKiso(profile.zaisanKiso),
    checkKekkaku(profile.kekkaku),
    checkSeijitsusei(profile.seijitsusei),
  ];

  const eligible = checks.every((c) => c.passed);
  const blockingIssues = checks
    .filter((c) => !c.passed)
    .map((c) => `[${c.label}] ${c.reasons.filter((r) => r).join(" / ")}`);

  return { eligible, checks, blockingIssues };
}

/**
 * 判定結果を人間が読みやすいテキストレポートに整形する（CLI表示・ログ・議事メモ用）。
 * @param {import('./types.js').ApplicantProfile} profile
 * @param {import('./types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatEligibilityReport(profile, result) {
  const lines = [];
  lines.push(`# 建設業許可 要件判定結果 — ${profile.applicantName}`);
  lines.push("");
  lines.push(`総合判定: ${result.eligible ? "○ 5要件すべて充足（申請準備を進められます）" : "× 未充足の要件があります"}`);
  lines.push("");
  for (const c of result.checks) {
    lines.push(`## ${c.passed ? "○" : "×"} ${c.label}`);
    for (const r of c.reasons) lines.push(`- ${r}`);
    for (const w of c.warnings) lines.push(`  - ⚠ ${w}`);
    lines.push("");
  }
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
