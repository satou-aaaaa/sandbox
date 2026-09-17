/**
 * 日本語能力水準要件（JLPT N4以上、JFT-Basic合格、または技能実習2号修了による免除）の判定。
 *
 * `GinouShikenInput.hasCompletedGinouJisshu2GoWell`と
 * `NihongoNouryokuInput.isExemptByGinouJisshu2Go`を別々の入力フィールドと
 * した理由: 技能実習2号修了は技能水準・日本語能力水準の双方に影響するが、
 * 実務上まれに「技能実習の内容により技能水準は満たすが日本語能力水準の
 * 免除は認められない」といった分野固有の例外が生じうるため、判定関数
 * （`ginouSuijun.js`・`nihongoNouryoku.js`）を疎結合に保ち、呼び出し側
 * （`engine.js`）が2つの入力を連動させるかどうかを決められるようにした。
 */
import { getField } from "./fieldRegistry.js";

/**
 * @param {import('./types.js').NihongoNouryokuInput} input
 * @param {string} fieldKey 分野固有の日本語試験要否を参照するために使う
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkNihongoNouryoku(input, fieldKey) {
  const reasons = [];
  const warnings = [];
  let passed = false;

  if (input.isExemptByGinouJisshu2Go) {
    passed = true;
    reasons.push("技能実習2号を良好に修了しているため、日本語試験は原則として免除されます");
  } else if (input.hasJlptN4OrAbove) {
    passed = true;
    reasons.push("日本語能力試験N4以上に合格しています");
  } else if (input.hasPassedJftBasic) {
    passed = true;
    reasons.push("JFT-Basic（国際交流基金日本語基礎テスト）に合格しています");
  } else {
    reasons.push("日本語能力試験N4以上・JFT-Basicのいずれの合格も確認できず、技能実習2号修了による免除にも該当しません");
  }

  const field = getField(fieldKey);
  if (passed && field?.requiresSectorSpecificJapaneseTest) {
    warnings.push(`分野「${field.fieldLabel}」では上記に加えて分野固有の日本語試験（例: 介護日本語評価試験）の合格が別途必要な場合があります。必ず確認してください`);
  }

  return { key: "nihongoNouryoku", label: "日本語能力水準要件", passed, reasons, warnings };
}
