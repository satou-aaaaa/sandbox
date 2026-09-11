/**
 * 要件3: 財産的基礎（または金銭的信用）
 *
 * 一般建設業と特定建設業で基準が大きく異なり、
 * 特定建設業は3条件すべてを満たす必要がある点に注意。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 *
 * @param {import('../types.js').ZaisanKisoInput} input
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkZaisanKiso(input) {
  const reasons = [];
  const warnings = [];
  let passed;

  if (input.licenseType === "一般") {
    const route1 = input.netAssets >= 5_000_000;
    const route2 = input.fundingCapacity >= 5_000_000;
    const route3 = !!input.hasFiveYearsContinuousOperation;

    if (route1) reasons.push(`自己資本 ${yen(input.netAssets)} が500万円以上で要件を満たします`);
    if (route2) reasons.push(`資金調達能力 ${yen(input.fundingCapacity)} が500万円以上で要件を満たします`);
    if (route3) reasons.push("直近5年間、許可を受けて継続して営業した実績があり要件を満たします");
    passed = route1 || route2 || route3;
    if (!passed) {
      reasons.push("自己資本500万円以上・資金調達能力500万円以上・5年間の継続営業実績のいずれも確認できません");
    }
  } else {
    // 特定建設業: 3条件すべて必須
    const deficitOk = input.deficitRatio <= 20;
    const currentRatioOk = input.currentRatio >= 75;
    const capitalOk = input.capitalAmount >= 20_000_000 && input.netAssets >= 40_000_000;

    reasons.push(
      deficitOk
        ? `欠損比率 ${input.deficitRatio}% が資本金の20%以下で条件クリア`
        : `欠損比率 ${input.deficitRatio}% が資本金の20%を超えています（要件未達）`
    );
    reasons.push(
      currentRatioOk
        ? `流動比率 ${input.currentRatio}% が75%以上で条件クリア`
        : `流動比率 ${input.currentRatio}% が75%未満です（要件未達）`
    );
    reasons.push(
      capitalOk
        ? `資本金 ${yen(input.capitalAmount)}（2,000万円以上）・自己資本 ${yen(input.netAssets)}（4,000万円以上）で条件クリア`
        : `資本金または自己資本が基準（資本金2,000万円以上かつ自己資本4,000万円以上）に達していません`
    );

    passed = deficitOk && currentRatioOk && capitalOk;
    warnings.push("特定建設業は上記3条件を「すべて」満たす必要があります（一般建設業のような選択制ではありません）");
  }

  return {
    key: "zaisanKiso",
    label: "財産的基礎（金銭的信用）",
    passed,
    reasons,
    warnings,
  };
}

/** @param {number} amount */
function yen(amount) {
  return `${(amount ?? 0).toLocaleString("ja-JP")}円`;
}
