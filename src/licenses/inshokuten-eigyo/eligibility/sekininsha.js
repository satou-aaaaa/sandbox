/**
 * 食品衛生責任者の設置要件の判定。
 *
 * 施設ごとに1名以上の設置が必須（調理師・製菓衛生師・栄養士等の資格
 * 保有者、または都道府県知事等が行う講習会の受講修了者が就任できる）。
 */

/**
 * @param {import('./types.js').SekininshaInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkSekininsha(input) {
  const reasons = [];
  let passed = true;

  if (!input.name || input.qualificationType === "未定") {
    passed = false;
    reasons.push("食品衛生責任者が未設置、または資格の種別が未定です");
  } else if (input.qualificationType === "講習会受講修了") {
    reasons.push(`${input.name}氏（講習会受講修了）を食品衛生責任者として設置予定です`);
  } else {
    reasons.push(`${input.name}氏（${input.qualificationType}資格による講習免除）を食品衛生責任者として設置予定です`);
  }
  if (passed && !input.isDesignatedPerStore) {
    passed = false;
    reasons.push("食品衛生責任者は店舗ごとの専属設置が必要です");
  }

  return {
    key: "sekininsha",
    label: "食品衛生責任者の設置",
    passed,
    reasons,
    warnings: [],
  };
}
