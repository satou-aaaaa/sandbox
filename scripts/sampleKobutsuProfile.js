/**
 * 古物商許可の書類生成サンプルスクリプト共通のダミー申請者データ。
 *
 * 実在の顧客データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/licenses/kobutsu/eligibility/types.js').KobutsuApplicantProfile}
 */
export function buildSampleKobutsuProfile() {
  return {
    applicantName: "山田 太郎",
    applicantNameKana: "ヤマダ タロウ",
    birthDate: "1985-04-01",
    address: "東京都千代田区霞が関1-1-1",
    phoneNumber: "03-1234-5678",
    businessName: "サンプルリサイクルショップ",
    kekkaku: {
      isUndischargedBankrupt: false,
      hasCriminalRecordWithin5Years: false,
      hasBoryokuFuhouKoiRisk: false,
      hasBoryokudanRelatedOrderWithin3Years: false,
      isAddressUnknown: false,
      hadLicenseRevokedWithin5Years: false,
      hasSurrenderedLicenseDuringRevocationHearingWithin5Years: false,
      hasMentalImpairmentAffectingDuties: false,
      isMinorWithoutCapacity: false,
    },
    eigyoshoList: [
      {
        officeName: "本店",
        hasLegitimateUsageRight: true,
        managerName: "山田 太郎",
        isManagerFullTime: true,
      },
    ],
    handledItemCategories: ["古物一般", "時計・宝飾品類"],
    usesInternet: false,
  };
}
