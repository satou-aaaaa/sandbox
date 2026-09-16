/**
 * 技人国ビザ申請支援モジュールの書類生成サンプルスクリプト共通のダミー
 * 申請データ。実在の外国人本人・受入企業データは絶対に使用しない（NFR-5）。
 * すべてダミー値。
 *
 * @returns {import('../src/licenses/gijinkoku/eligibility/types.js').GijinkokuApplicantProfile}
 */
export function buildSampleGijinkokuProfile() {
  return {
    applicantName: "Sample Applicant",
    nationality: "ベトナム",
    companyName: "サンプルITソリューションズ株式会社",
    companyCategory: 2,
    gakureki: {
      educationLevel: "大学卒業以上",
      isInternationalServiceCategory: false,
    },
    kanrensei: {
      majorOrExperienceField: "情報工学（ソフトウェア工学専攻）",
      jobDescription: "自社開発システムのソフトウェア設計・プログラミング業務",
    },
    hoshu: {
      offeredSalaryAnnual: 4_500_000,
      comparableJapaneseSalaryAnnual: 4_000_000,
    },
  };
}
