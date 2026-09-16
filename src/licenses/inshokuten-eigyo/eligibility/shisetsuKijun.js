/**
 * 施設基準（厨房設備・換気・給排水・手洗い設備等）の判定。
 *
 * 令和3年6月1日施行の食品衛生法改正で明確化された「洗浄後の手指の
 * 再汚染防止構造」（ひねる水栓不可）を必須項目に含める。具体的な数値
 * 基準は自治体の食品衛生法施行条例により異なりうるため、本フェーズは
 * 代表的な基準セット1種類の実装に留める（要件定義書NFR-I2）。
 */

/**
 * @param {import('./types.js').ShisetsuKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkShisetsuKijun(input) {
  const reasons = [];
  const warnings = [];
  const flags = [
    [input.sinkCount < 2, "シンクが2槽未満です（2槽以上が目安）"],
    [!input.hasNonTouchHandwashing, "手洗い設備が「洗浄後の手指の再汚染を防止できる構造」になっていません（ひねる水栓のみは不可）"],
    [!input.hasWashableWallFloorMaterial, "床・壁・天井が耐水性・清掃しやすい材質になっていません"],
    [!input.hasAdequateVentilation, "適切な換気設備が確認できません"],
    [!input.hasProperDrainage, "適切な給排水設備・グリストラップが確認できません"],
  ];
  const anyFailing = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(/** @type {string} */ (message));
  }
  if (input.usesTankOrWellWater && !input.hasWaterQualityTestReport) {
    warnings.push("貯水槽水・井戸水を使用するため、水質検査成績書の準備状況を確認してください");
  }
  if (!anyFailing) reasons.push("施設基準の主要項目はすべて満たしています");

  return {
    key: "shisetsuKijun",
    label: "施設基準（厨房・換気・給排水・手洗い設備等）",
    passed: !anyFailing,
    reasons,
    warnings,
  };
}
