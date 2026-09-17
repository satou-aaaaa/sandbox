/**
 * 技能水準要件（分野別技能評価試験の合格、または技能実習2号の良好な修了）の判定。
 */
import { getField } from "./fieldRegistry.js";

/**
 * @param {import('./types.js').GinouShikenInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkGinouSuijun(input) {
  const field = getField(input.fieldKey);
  const fieldLabel = field?.fieldLabel ?? input.fieldKey;
  const reasons = [];
  const warnings = [];
  let passed = false;

  if (input.hasPassedSkillTest) {
    passed = true;
    reasons.push(`分野「${fieldLabel}」の技能評価試験（${field?.skillTestName ?? "分野別試験"}）に合格しています`);
  } else if (input.hasCompletedGinouJisshu2GoWell) {
    passed = true;
    reasons.push("技能実習2号を良好に修了しているため、技能水準要件は満たされているものとみなされます");
    if (input.isSameWorkCategoryAsGinouJisshu === false) {
      warnings.push("修了した技能実習の作業区分と特定技能の業務区分が同一でない可能性があります。移行の可否は個別に確認してください");
    } else if (input.isSameWorkCategoryAsGinouJisshu === undefined) {
      warnings.push("修了した技能実習の作業区分と特定技能の業務区分が同一区分内かどうか、必ず確認してください");
    }
  } else {
    reasons.push(`分野「${fieldLabel}」の技能評価試験に合格しておらず、技能実習2号の良好な修了もありません`);
  }

  if (field?.supplementaryNote) {
    warnings.push(`分野固有の留意事項: ${field.supplementaryNote}`);
  }

  return { key: "ginouSuijun", label: "技能水準要件", passed, reasons, warnings };
}
