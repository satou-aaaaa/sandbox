/**
 * 住宅宿泊事業（民泊）届出の書類生成サンプルスクリプト共通のダミー届出者データ。
 *
 * 実在の顧客データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/licenses/minpaku/eligibility/types.js').MinpakuApplicantProfile}
 */
export function buildSampleMinpakuProfile() {
  return {
    applicantName: "鈴木 花子",
    address: "東京都渋谷区神南1-1-1",
    propertyAddress: "東京都渋谷区代々木2-2-2",
    residentType: "家主居住型",
    kekkaku: {
      hasMentalOrPhysicalImpairment: false,
      isUndischargedBankrupt: false,
      hadBusinessSuspensionOrderWithin3Years: false,
      hasCriminalRecordWithin3Years: false,
      isBoryokudanRelated: false,
    },
    requiredDocuments: [
      { key: "touki-jikou-shomeisho", label: "登記事項証明書", obtained: true },
      { key: "zumen", label: "図面", obtained: true },
      { key: "shobo-hoi-tsuchisho", label: "消防法令適合通知書", obtained: true },
      { key: "seiyakusho", label: "誓約書", obtained: true },
    ],
  };
}
