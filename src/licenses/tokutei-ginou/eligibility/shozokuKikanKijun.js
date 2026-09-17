/**
 * 特定技能所属機関（受入れ機関）自体が満たすべき基準の判定。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】「特定技能雇用契約及び一号特定
 * 技能外国人支援計画の基準等を定める省令」（平成三十一年法務省令第五号）
 * 第1条第1項第3号「外国人に対する報酬の額が日本人が従事する場合の報酬の
 * 額と同等以上であること」、第2条第1項第4号（労働・社会保険・租税
 * 関係法令違反、入管法令違反等による一定期間の欠格事由）を確認した。
 * 実際の条文はさらに詳細（直近1年以内の非自発的離職・失踪者発生の有無等）
 * だが、フェーズ1は代表的な項目（労働法令・入管法令違反の5年遡り、報酬
 * 水準）に絞る（`ShozokuKikanKijunInput`のJSDoc参照。号立ての全項目化は
 * 9章の拡張ポイント）。
 */

/**
 * @param {import('./types.js').ShozokuKikanKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkShozokuKikanKijun(input) {
  const reasons = [];
  const flags = [
    [!input.noLaborLawViolationWithin5Years, "過去5年以内に労働関係法令違反による処分を受けています"],
    [!input.noImmigrationLawViolationWithin5Years, "過去5年以内に入管法令違反による処分を受けています"],
    [input.offeredSalaryAnnual < input.comparableJapaneseSalaryAnnual, "提示年収が、同種業務に従事する日本人の年収水準を下回っています"],
  ];
  const anyFailing = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(/** @type {string} */ (message));
  }
  if (!anyFailing) {
    reasons.push(`${input.companyName}は特定技能所属機関としての基準（労働関係法令・入管法令の遵守実績、報酬水準）を満たしています`);
  }

  return { key: "shozokuKikanKijun", label: "特定技能所属機関の基準", passed: !anyFailing, reasons, warnings: [] };
}
