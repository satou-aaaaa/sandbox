/**
 * X1・X2・Z・Wの入力データが、申請に最低限必要な形式を満たしているかを
 * 確認する。評点そのものは計算しない（docs/DESIGN_keiei-jiko-shinsa-core.md
 * 1章の設計原則参照。国土交通省の評点テーブル・算定式は毎年度改定され得る
 * ため、精密な再現は対象外）。
 *
 * @param {import('./types.js').X1Input} x1
 * @param {import('./types.js').X2Input} x2
 * @param {import('./types.js').ZInput} z
 * @param {import('./types.js').WInput} w
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkInputCompleteness(x1, x2, z, w) {
  const reasons = [];
  let passed = true;

  if (!x1.annualCompletedWorkAmounts || x1.annualCompletedWorkAmounts.length < 2) {
    passed = false;
    reasons.push("X1（完成工事高）: 直前2期分以上の完成工事高が入力されていません。");
  }
  if (x2.latestNetAssets == null) {
    passed = false;
    reasons.push("X2（経営規模）: 直近期の自己資本額が未入力です。");
  }
  if (!z.technicalStaff || z.technicalStaff.length === 0) {
    passed = false;
    reasons.push("Z（技術力）: 技術職員の情報が1件も入力されていません。");
  }
  if (w.isSocialInsuranceEnrolled === undefined) {
    passed = false;
    reasons.push("W（社会性等）: 社会保険の加入状況が未入力です。");
  }
  if (passed) reasons.push("X1・X2・Z・Wの入力データは、申請に必要な形式を満たしています（点数評価は行っていません）。");

  return { key: "inputCompleteness", label: "評価項目データの入力完備性", passed, reasons, warnings: [] };
}
