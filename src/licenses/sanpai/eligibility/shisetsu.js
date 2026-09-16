/**
 * 運搬施設（車両・容器等）の飛散・流出・悪臭防止措置の要件（FR-S1.4）。
 * 現地確認が必要な項目であり、自己申告だけで機械的に合格とはせず、
 * 建設業許可の誠実性要件（seijitsusei.js）と同様、必ず人手確認を促す
 * warning を付ける設計にしている。
 *
 * @param {boolean} hasOdorSpillPreventionMeasures 運搬容器の飛散・流出・悪臭防止措置（自己申告）
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkShisetsu(hasOdorSpillPreventionMeasures) {
  const passed = !!hasOdorSpillPreventionMeasures;
  return {
    key: "shisetsu",
    label: "運搬施設の要件",
    passed,
    reasons: [
      passed
        ? "自己申告上、運搬容器の飛散・流出・悪臭防止措置は取られています"
        : "自己申告上、運搬容器の飛散・流出・悪臭防止措置が取られていません",
    ],
    warnings: ["運搬施設の要件は現地確認が必要な項目のため、本ツールの結果を鵜呑みにせず、行政書士本人が実際の車両・容器を個別に確認してください"],
  };
}
