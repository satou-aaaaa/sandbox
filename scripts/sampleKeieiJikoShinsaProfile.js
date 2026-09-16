/**
 * 経営事項審査（経審）申請支援モジュールの書類生成サンプルスクリプト共通の
 * ダミーデータ。実在の顧客・財務データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/licenses/keiei-jiko-shinsa/eligibility/types.js').KeieiJikoShinsaApplicantProfile}
 */
export function buildSampleKeieiJikoShinsaProfile() {
  return {
    applicantName: "サンプル建設株式会社",
    representativeName: "佐藤 一郎",
    prerequisite: {
      isKessanHenkoTodokeSubmitted: true,
      targetGyoshu: ["とび・土工工事業", "管工事業"],
    },
    x1: {
      annualCompletedWorkAmounts: [120_000_000, 135_000_000],
      averagingMethod: "2年平均",
    },
    x2: {
      latestNetAssets: 50_000_000,
      averageProfitBeforeInterest: 6_000_000,
    },
    yBunsekiStatus: "結果受領済み",
    z: {
      technicalStaff: [
        { qualification: "1級土木施工管理技士", count: 2 },
        { qualification: "2級管工事施工管理技士", count: 1 },
      ],
      averageDirectContractCompletedWorkAmount: 90_000_000,
    },
    w: {
      isSocialInsuranceEnrolled: true,
      yearsInBusiness: 15,
      hasDisasterAgreement: true,
      hasBusinessSuspensionWithin1Year: false,
      isIso9001Registered: false,
      isIso14001Registered: false,
    },
  };
}

/** @returns {import('../src/core/reminders/digest.js').ClientRecord} */
export function buildSampleClientWithConstruction() {
  return {
    clientName: "サンプル建設株式会社",
    fiscalYearEndIso: "2026-03-31",
    licenses: [{ licenseId: "般-とび土工工事業", licenseCategory: "construction", grantDateIso: "2024-04-01" }],
  };
}
