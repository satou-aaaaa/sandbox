/**
 * 学歴・実務経験要件を判定する。
 *
 * 参照: e-Gov法令検索「出入国管理及び難民認定法第七条第一項第二号の基準を
 * 定める省令」（入管法基準省令）別表第一の二の表・技術・人文知識・国際業務の項
 * （2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/402M50000010016
 *
 * @param {import('./types.js').GakurekiInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkGakureki(input) {
  const reasons = [];
  /** @type {boolean} */
  let passed;

  if (input.isInternationalServiceCategory) {
    // 項目二（国際業務区分）: 学歴要件そのものは無く、原則3年以上の実務経験が
    // 必要。ただし大学卒業者が通訳・翻訳・語学の指導に従事する場合のみ、
    // この3年要件が免除される（基準省令二号ロただし書）。他の国際業務
    // （広報・宣伝・海外取引業務・デザイン等）には学歴による免除は無く、
    // 大学を卒業していても3年の実務経験が必要な点に注意。
    if (input.educationLevel === "大学卒業以上" && input.isTranslationInterpretationOrLanguageInstruction) {
      passed = true;
      reasons.push("大学卒業者が通訳・翻訳・語学の指導に従事するため、実務経験要件は免除されます");
    } else {
      const requiredYears = 3;
      passed = (input.yearsOfRelevantExperience ?? 0) >= requiredYears;
      reasons.push(
        passed
          ? `実務経験 ${input.yearsOfRelevantExperience}年（${requiredYears}年以上）で要件を満たしています`
          : `実務経験が${requiredYears}年に達していません（国際業務区分に大学卒業による一律免除は無く、通訳・翻訳・語学の指導以外の業務では学歴に関わらず実務経験が必要です）`
      );
    }
  } else if (input.educationLevel === "大学卒業以上" || input.educationLevel === "専修学校専門課程修了") {
    // 項目一（自然科学・人文科学分野の技術・知識を要する業務）
    passed = true;
    reasons.push(`学歴要件（${input.educationLevel}）を満たしています`);
  } else {
    const requiredYears = 10; // 基準省令別表第一の二の表・技術・人文知識・国際業務の項・一号ハ
    passed = (input.yearsOfRelevantExperience ?? 0) >= requiredYears;
    reasons.push(
      passed
        ? `実務経験 ${input.yearsOfRelevantExperience}年（${requiredYears}年以上）で要件を満たしています`
        : `学歴要件を満たさず、実務経験も${requiredYears}年に達していません`
    );
  }
  return { key: "gakureki", label: "学歴・実務経験要件", passed, reasons, warnings: [] };
}
