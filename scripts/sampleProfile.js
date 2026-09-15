/**
 * 書類生成サンプルスクリプト共通のダミー申請者データ。
 *
 * 実在の顧客データは絶対に使用しない（NFR-5）。すべてダミー値。
 * 各 generate-*-sample.js はこの関数を呼び出して同じ申請者データから
 * それぞれの様式サマリーを生成する（様式ごとにダミーデータを個別に
 * 定義しない。ApplicantProfile が唯一のデータソースであることの実例にもなる）。
 *
 * @returns {import('../src/licenses/construction/eligibility/types.js').ApplicantProfile}
 */
export function buildSampleApplicantProfile() {
  return {
    applicantName: "サンプル建設株式会社",
    representativeName: "山田 太郎",
    address: "東京都千代田区霞が関1-1-1",
    prefecture: "東京都",
    applicationDate: "2026-09-11",
    constructionTypes: ["建築工事業", "電気工事業"],
    officers: [
      { name: "山田 太郎", title: "代表取締役", birthDate: "1975-04-01" },
      { name: "鈴木 花子", title: "取締役", birthDate: "1980-11-20" },
    ],
    keishinRequest: {
      applicantNameKana: "サンプルケンセツカブシキガイシャ",
      corporateNumber: "1234567890123",
      phoneNumber: "03-1234-5678",
      licenseNumber: "東京都知事許可（般-01）第12345号",
      licenseGrantDateIso: "2021-10-21",
      licenseAuthorityType: "知事",
      reviewDateIso: "2026-03-31",
      useNetAssetsTwoYearAverage: false,
      operatingProfit: 3_500_000,
      depreciationAmount: 800_000,
      analysisOrganizationName: "サンプル経営状況分析センター",
      analysisOrganizationNumber: "0001",
    },
    completedConstructionCost: {
      materialCost: 12_000_000,
      laborCost: 8_000_000,
      subcontractedLaborCost: 2_000_000,
      subcontractCost: 15_000_000,
      expenses: 3_000_000,
      personnelExpenses: 1_200_000,
    },
    constructionHistory: [
      {
        constructionType: "建築工事業",
        isSubcontract: false,
        orderer: "サンプル物産株式会社",
        projectName: "サンプル物産本社ビル新築工事",
        contractAmount: 45_000_000,
        startDateIso: "2025-04",
        completionDateIso: "2025-12",
        assignedEngineerName: "佐藤 一郎",
        engineerRole: "主任技術者",
      },
      {
        constructionType: "建築工事業",
        isSubcontract: true,
        orderer: "サンプル建材工業株式会社",
        projectName: "サンプル倉庫増築工事",
        contractAmount: 8_500_000,
        completionDateIso: "2025-08",
      },
    ],
    keieiGyomuKanri: {
      yearsAsResponsibleOfficer: 6,
      yearsAsQuasiResponsibleOfficer: 0,
      yearsAsAssistant: 0,
      isOfficerFor2Years: false,
      assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
      hasSocialInsurance: true,
      responsibleName: "山田 太郎",
      responsibleTitle: "代表取締役",
    },
    senninGijutsushaList: [
      {
        officeName: "本店",
        personName: "佐藤 一郎",
        licenseType: "一般",
        hasNationalLicense: true,
        isDesignatedCourseGraduate: false,
        educationLevel: null,
        yearsOfPracticalExperience: 0,
        yearsOfGeneralExperience: 0,
        yearsOfSupervisoryExperience: 0,
      },
    ],
    zaisanKiso: {
      licenseType: "一般",
      netAssets: 6_000_000,
      fundingCapacity: 0,
      hasFiveYearsContinuousOperation: false,
      capitalAmount: 0,
      deficitRatio: 0,
      currentRatio: 0,
    },
    kekkaku: {
      isUndischargedBankrupt: false,
      hadLicenseRevokedWithin5Years: false,
      hasCriminalRecordWithin5Years: false,
      isBoryokudanMemberOrWithin5Years: false,
      hasMentalImpairmentAffectingDuties: false,
      hasFalseOrOmittedStatement: false,
    },
    seijitsusei: { hasNoDishonestActRisk: true },
  };
}
