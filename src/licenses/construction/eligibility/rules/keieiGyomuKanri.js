/**
 * 要件1: 経営業務の管理を適正に行うに足りる体制（経営業務管理体制）
 *
 * 令和2年10月の建設業法改正により、「経営業務管理責任者を必ず1名専任で置く」という
 * 硬直的な要件から、複数の経験パス（準ずる地位・補佐体制を含む）で満たせる
 * 「経営業務管理体制」要件に緩和されている。本モジュールはその複数パスを判定する。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 *
 * @param {import('../types.js').KeieiGyomuKanriInput} input
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkKeieiGyomuKanri(input) {
  const reasons = [];
  const warnings = [];

  // ルートA: 責任者として5年以上
  const routeA = input.yearsAsResponsibleOfficer >= 5;
  // ルートB: 準ずる地位（経営権限の委任を受けた者等）として5年以上
  const routeB = input.yearsAsQuasiResponsibleOfficer >= 5;
  // ルートC: 補佐する業務として6年以上
  const routeC = input.yearsAsAssistant >= 6;
  // ルートD: 直近2年以上役員等 + 財務・労務・運営の各補佐者を5年以上配置
  const support = input.assistantSupportYears || { finance: 0, labor: 0, operations: 0 };
  const routeD =
    !!input.isOfficerFor2Years &&
    support.finance >= 5 &&
    support.labor >= 5 &&
    support.operations >= 5;

  const anyRoutePassed = routeA || routeB || routeC || routeD;

  if (routeA) reasons.push(`経営業務管理責任者としての経験 ${input.yearsAsResponsibleOfficer}年（5年以上）でルートA該当`);
  if (routeB) reasons.push(`準ずる地位での経験 ${input.yearsAsQuasiResponsibleOfficer}年（5年以上）でルートB該当`);
  if (routeC) reasons.push(`補佐業務での経験 ${input.yearsAsAssistant}年（6年以上）でルートC該当`);
  if (routeD) reasons.push(`役員等2年以上 + 財務・労務・運営の補佐者を各5年以上配置でルートD該当`);
  if (!anyRoutePassed) {
    reasons.push("経営業務管理責任者としての経験・準ずる地位・補佐業務・複合要件（ルートA〜D）のいずれも基準年数に達していません");
  }

  const hasInsurance = !!input.hasSocialInsurance;
  if (!hasInsurance) {
    reasons.push("健康保険・厚生年金保険・雇用保険への適切な加入が確認できていません（本要件も必須）");
  }

  if (routeD) {
    warnings.push("ルートDは複合要件のため、財務・労務・運営それぞれの補佐者の在籍を証明する書類（組織図・辞令等）を別途準備してください");
  }

  const passed = anyRoutePassed && hasInsurance;

  return {
    key: "keieiGyomuKanri",
    label: "経営業務の管理を適正に行う体制",
    passed,
    reasons,
    warnings,
  };
}
