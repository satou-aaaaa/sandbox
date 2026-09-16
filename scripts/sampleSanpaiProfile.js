/**
 * 産業廃棄物収集運搬業許可の書類生成サンプルスクリプト共通のダミー申請者データ。
 *
 * 実在の顧客データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/licenses/sanpai/eligibility/types.js').SanpaiApplicantProfile}
 */
export function buildSampleSanpaiProfile() {
  return {
    applicantName: "サンプル運輸株式会社",
    representativeName: "佐藤 一郎",
    address: "愛知県名古屋市中区三の丸1-1-1",
    prefecture: "愛知県",
    kekkaku: {
      hasMentalImpairmentAffectingDuties: false,
      isUndischargedBankrupt: false,
      hasCriminalRecordWithin5Years: false,
      hasWasteLawViolationWithin5Years: false,
      hadPermitRevokedWithin5Years: false,
      hasBusinessClosureDuringRevocationProcessWithin5Years: false,
      hasDishonestConductRisk: false,
      isBoryokudanRelated: false,
    },
    koushu: {
      completionDateIso: "2024-04-01",
      plannedApplicationDateIso: "2026-09-16",
    },
    keiriKiso: {
      latestNetAssets: 3_000_000,
      latestOperatingIncome: 500_000,
    },
    hasOdorSpillPreventionMeasures: true,
    vehicles: [
      { vehicleType: "4tダンプ", plateNumber: "名古屋100 あ 12-34", hasSpillPreventionMeasures: true },
      { vehicleType: "2tパッカー車", plateNumber: "名古屋400 い 56-78", hasSpillPreventionMeasures: true },
    ],
    wasteTypes: ["がれき類", "木くず"],
  };
}
