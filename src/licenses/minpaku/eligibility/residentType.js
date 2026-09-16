/**
 * 家主居住型／家主不在型の別に応じた注意喚起（FR-M1.2）。
 *
 * 届出制であり合否判定の対象ではないため、常に `passed: true`
 * （合否には影響しない）とし、家主不在型で住宅宿泊管理業者への委託先が
 * 未確定の場合にのみ warning を出す。委託先の選定支援自体は対象外
 * （docs/REQUIREMENTS_minpaku-core.md 4.5節スコープ外）。
 *
 * @param {"家主居住型" | "家主不在型"} residentType
 * @param {string} [managementCompanyName]
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkResidentType(residentType, managementCompanyName) {
  const needsManagementCompany = residentType === "家主不在型";
  const warnings =
    needsManagementCompany && !managementCompanyName
      ? ["家主不在型のため、住宅宿泊管理業者への管理委託が必須です。委託先を確定してください（委託先の選定支援自体は本ツールの対象外です）"]
      : [];
  return {
    key: "residentType",
    label: "家主居住型／家主不在型の確認",
    passed: true,
    reasons: [`${residentType}として届出予定です`],
    warnings,
  };
}
