/**
 * 一般基準（転用の確実性・周辺農地への配慮）を判定する。建設業許可の
 * zaisanKiso.js・産廃許可のkeiriKiso.jsと同様、財務・計画面の確認は
 * 形式的なチェックに留める。
 *
 * @param {import('./types.js').NouchiTenyoIppanKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkIppanKijun(input) {
  const reasons = [];
  const warnings = [];
  let passed = true;

  if (!input.hasSufficientFundsAndCredit) {
    passed = false;
    reasons.push("転用を確実に行うための資力・信用が確認できていません（融資内諾書・自己資金証明等の提出が必要です）");
  }
  if (!input.hasConstructionSchedule) {
    passed = false;
    reasons.push("工事計画・工程表が具体的に定まっていません");
  }
  if (!input.hasNeighborDamagePreventionMeasures) {
    passed = false;
    reasons.push("周辺農地への被害防除措置（排水計画等）が確認できていません");
  }
  if (passed) {
    reasons.push("一般基準（転用の確実性・周辺農地への被害防除措置）を満たしています");
  }
  if (!input.hasNeighborConsent) {
    warnings.push("隣接農地所有者等の同意書の要否は都道府県・農業委員会の運用によって異なります。必ず事前相談で確認してください");
  }

  return { key: "ippanKijun", label: "一般基準（転用の確実性・周辺農地への配慮）", passed, reasons, warnings };
}
