/**
 * 営業所・管理者要件（古物営業法第13条）を判定する。営業所単位の入力配列を
 * まとめて判定する点は、建設業許可の senninGijutsusha.js（専任技術者の
 * 営業所単位判定）と同じ構造。
 *
 * 参照: e-Gov法令検索「古物営業法」第13条（2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/324AC0000000108
 *
 * @param {import('./types.js').KobutsuEigyoshoInput[]} eigyoshoList
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKobutsuEigyosho(eigyoshoList) {
  const reasons = [];
  const warnings = [];

  if (!eigyoshoList || eigyoshoList.length === 0) {
    return {
      key: "kobutsuEigyosho",
      label: "営業所・管理者の要件",
      passed: false,
      reasons: ["営業所の情報が入力されていません"],
      warnings: [],
    };
  }

  let allPassed = true;

  for (const office of eigyoshoList) {
    if (!office.hasLegitimateUsageRight) {
      allPassed = false;
      reasons.push(`${office.officeName}: 営業所の実在性・使用権限が未確認です`);
    }
    if (!office.managerName) {
      allPassed = false;
      reasons.push(`${office.officeName}: 管理者が選任されていません`);
    } else if (!office.isManagerFullTime) {
      warnings.push(`${office.officeName}: 管理者（${office.managerName}）の常勤性を確認してください`);
    }
  }
  if (allPassed) reasons.push("全営業所で使用権限の確認・管理者の選任ができています");

  return {
    key: "kobutsuEigyosho",
    label: "営業所・管理者の要件",
    passed: allPassed,
    reasons,
    warnings,
  };
}
