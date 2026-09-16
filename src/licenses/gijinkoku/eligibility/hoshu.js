/**
 * 報酬要件（日本人が従事する場合と同等額以上の報酬を受けること）を判定する。
 *
 * 参照: e-Gov法令検索「入管法基準省令」別表第一の二の表・技術・人文知識・
 * 国際業務の項（2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/402M50000010016
 *
 * @param {import('./types.js').HoshuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkHoshu(input) {
  const passed = input.offeredSalaryAnnual >= input.comparableJapaneseSalaryAnnual;
  return {
    key: "hoshu",
    label: "報酬要件（日本人と同等額以上）",
    passed,
    reasons: [
      passed
        ? `提示年収 ${input.offeredSalaryAnnual.toLocaleString()}円は比較水準（${input.comparableJapaneseSalaryAnnual.toLocaleString()}円）以上です`
        : "提示年収が比較水準を下回っています。給与条件の見直しが必要です",
    ],
    warnings: [],
  };
}
