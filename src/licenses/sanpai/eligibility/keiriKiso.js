/**
 * 経理的基礎（直近期のみの簡易判定）。
 *
 * 産廃の経理的基礎は環境省通知に基づく複数の算定パターン（直近1期の基準を
 * 満たさなくても過去3〜5期の平均等で救済される場合がある）があるが、本
 * フェーズでは「直近期が債務超過かどうか」の単純な形式チェックに留め、
 * 複雑な救済パターンの判定は対象外とする（docs/REQUIREMENTS_sanpai-core.md
 * 4.6節スコープ外）。債務超過に該当する場合も「直ちに不合格」とはせず、
 * 改善計画等による説明の余地がある旨の注記付き警告とする（FR-S1.3）。
 *
 * @param {import('./types.js').KeiriKisoInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKeiriKiso(input) {
  const isInsolvent = input.latestNetAssets < 0;
  const warnings = isInsolvent
    ? ["直近期の自己資本額が債務超過です。改善計画等による説明の余地があるため、行政書士・税理士と連携して個別に確認してください"]
    : [];
  return {
    key: "keiriKiso",
    label: "経理的基礎",
    passed: !isInsolvent,
    reasons: [isInsolvent ? "直近期の自己資本額が債務超過です" : "直近期の自己資本額は債務超過に該当しません"],
    warnings,
  };
}
