/**
 * 要件判定結果の集約ロジック（許可種別非依存）。
 *
 * 個別のRequirementCheckResult配列から総合判定結果を導く部分だけを担う。
 * 個々の要件チェック関数・都道府県固有ルールの合成等、許可種別固有の
 * ロジックは各 src/licenses/<種別>/eligibility/engine.js 側の責務とする
 * （docs/DESIGN_kobutsu-core.md 5.1節参照）。
 */

/**
 * 個別のRequirementCheckResult配列から、総合判定結果を集約する。
 * @param {import('./types.js').RequirementCheckResult[]} checks
 * @returns {{ eligible: boolean, blockingIssues: string[] }}
 */
export function aggregateEligibility(checks) {
  const eligible = checks.every((c) => c.passed);
  const blockingIssues = checks
    .filter((c) => !c.passed)
    .map((c) => `[${c.label}] ${c.reasons.filter((r) => r).join(" / ")}`);
  return { eligible, blockingIssues };
}

/**
 * 判定結果を人間可読なテキストレポートに整形する共通部分（各要件のチェック
 * 結果一覧のみ）。見出し・総合判定文言・未充足の要因まとめ等は許可種別ごとに
 * 異なりうるため、呼び出し側で組み立てる。
 * @param {import('./types.js').RequirementCheckResult[]} checks
 * @returns {string[]} テキスト行の配列（呼び出し側で見出し等と結合する）
 */
export function formatChecksSection(checks) {
  const lines = [];
  for (const c of checks) {
    lines.push(`## ${c.passed ? "○" : "×"} ${c.label}`);
    for (const r of c.reasons) lines.push(`- ${r}`);
    for (const w of c.warnings) lines.push(`  - ⚠ ${w}`);
    lines.push("");
  }
  return lines;
}
