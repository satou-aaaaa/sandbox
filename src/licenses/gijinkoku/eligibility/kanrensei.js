/**
 * 専攻科目（またはこれに相当する実務経験の内容）と、従事する職務内容との
 * 関連性（FR-G1.3）。
 *
 * 関連性の判断は個別の審査官裁量が大きく機械判定が困難なため、機械的な
 * 自動判定は行わず、判定材料となる入力を整理したうえで、必ず人手確認を
 * 促す警告を出す（建設業許可の誠実性要件`seijitsusei.js`と同型の設計）。
 *
 * @param {import('./types.js').KanranseiInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKanrensei(input) {
  return {
    key: "kanrensei",
    label: "専攻・職務内容の関連性",
    passed: true,
    reasons: [
      `専攻分野・実務経験の分野: ${input.majorOrExperienceField}`,
      `従事する職務内容: ${input.jobDescription}`,
    ],
    warnings: [
      "専攻分野（または実務経験の内容）と職務内容の関連性は、出入国在留管理局の個別審査による裁量的判断のため、本ツールでは機械的に判定していません。行政書士本人が両者の関連性を具体的に説明できるか、必ず個別に確認してください",
    ],
  };
}
