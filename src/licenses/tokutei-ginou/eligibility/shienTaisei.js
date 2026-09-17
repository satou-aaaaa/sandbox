/**
 * 1号特定技能外国人支援計画の実施体制の判定。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】義務的支援10項目は「特定技能
 * 雇用契約及び一号特定技能外国人支援計画の基準等を定める省令」（平成
 * 三十一年法務省令第五号）第3条イ〜ヌで定められている（事前ガイダンス・
 * 送迎・住居確保等の生活支援・生活オリエンテーション・公的手続への
 * 同行・日本語学習機会の提供・相談苦情対応・日本人との交流促進・
 * 転職支援・定期面談と行政機関への通報の10項目。条文と対応関係を確認
 * 済み）。
 */

const MANDATORY_SUPPORT_LABELS = [
  "事前ガイダンスの提供",
  "出入国時の送迎",
  "住居確保・生活契約支援",
  "生活オリエンテーションの実施",
  "公的手続への同行",
  "日本語学習機会の提供",
  "相談・苦情への対応",
  "日本人との交流促進",
  "転職支援（受入れ機関都合の離職時）",
  "定期的な面談・行政機関への通報",
];

/**
 * 1号特定技能外国人支援計画の実施体制を判定する。
 * 自社実施の場合は体制基準（支援責任者・支援担当者の選任、多言語対応、
 * 生活相談業務経験者の配置）を確認し、委託の場合は委託先の記録の有無を確認する。
 * 義務的支援10項目のカバー状況は判定結果と別に警告として出す。
 *
 * @param {import('./types.js').ShienTaiseiInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkShienTaisei(input) {
  const reasons = [];
  const warnings = [];
  let passed = true;

  if (input.shienMethod === "全部委託") {
    if (!input.registeredSupportOrgName) {
      passed = false;
      reasons.push("支援計画を全部委託する方針ですが、委託先の登録支援機関名が未記入です");
    } else {
      reasons.push(`支援計画は登録支援機関「${input.registeredSupportOrgName}」への全部委託により実施します`);
      warnings.push("委託先が出入国在留管理庁の登録支援機関として有効に登録されているか、発注者側で確認してください（本ツールでは確認しません）");
    }
  } else {
    // 自社実施・一部委託は、いずれも自社側の基準を満たす必要がある
    const selfChecks = [
      [input.hasShienSekininsha, "支援責任者が選任されていません"],
      [input.hasShienTantousha, "支援担当者が選任されていません"],
      [input.hasStaffWithSodanExperience, "過去2年以内に生活相談業務の経験がある者が配置されていません"],
      [input.canSupportInUnderstandableLanguage, "外国人が理解できる言語での支援体制が確認できていません"],
    ];
    for (const [ok, message] of selfChecks) {
      if (!ok) {
        passed = false;
        reasons.push(/** @type {string} */ (message));
      }
    }
    if (passed) {
      reasons.push(`自社基準を満たしており、支援計画を「${input.shienMethod}」により実施できます`);
    }
    if (input.shienMethod === "一部委託" && !input.registeredSupportOrgName) {
      warnings.push("一部委託の方針ですが、委託先の登録支援機関名が未記入です");
    }
  }

  const uncoveredCount = input.mandatorySupportItemsCovered.filter((covered) => !covered).length;
  if (uncoveredCount > 0) {
    input.mandatorySupportItemsCovered.forEach((covered, i) => {
      if (!covered) warnings.push(`義務的支援10項目のうち「${MANDATORY_SUPPORT_LABELS[i]}」が計画に含まれていません`);
    });
  }

  return { key: "shienTaisei", label: "支援計画の実施体制要件", passed, reasons, warnings };
}
