/**
 * 特定技能モジュールの書類生成サンプルスクリプト共通のダミー申請データ。
 * 実在の外国人本人・受入企業データは絶対に使用しない（NFR-5）。すべて
 * ダミー値。
 *
 * @returns {import('../src/licenses/tokutei-ginou/eligibility/types.js').TokuteiGinouApplicantProfile}
 */
export function buildSampleTokuteiGinouProfile() {
  return {
    applicantName: "Sample Applicant",
    nationality: "ベトナム",
    jobDescription: "サンプル飲食店における調理・接客業務全般",
    ginouShiken: {
      fieldKey: "gaishokugyou",
      hasPassedSkillTest: true,
      hasCompletedGinouJisshu2GoWell: false,
    },
    nihongoNouryoku: {
      hasJlptN4OrAbove: true,
      hasPassedJftBasic: false,
      isExemptByGinouJisshu2Go: false,
    },
    shozokuKikanKijun: {
      companyName: "サンプル飲食株式会社",
      noLaborLawViolationWithin5Years: true,
      noImmigrationLawViolationWithin5Years: true,
      offeredSalaryAnnual: 3_200_000,
      comparableJapaneseSalaryAnnual: 3_000_000,
    },
    shienTaisei: {
      shienMethod: "自社実施",
      hasShienSekininsha: true,
      hasShienTantousha: true,
      hasStaffWithSodanExperience: true,
      canSupportInUnderstandableLanguage: true,
      mandatorySupportItemsCovered: new Array(10).fill(true),
    },
  };
}
