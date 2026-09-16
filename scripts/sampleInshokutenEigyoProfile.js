/**
 * 飲食店営業許可モジュールの書類生成サンプルスクリプト共通のダミー申請
 * データ。実在の申請者・店舗データは絶対に使用しない（NFR-5）。すべて
 * ダミー値。
 *
 * @returns {import('../src/licenses/inshokuten-eigyo/eligibility/types.js').InshokutenApplicantProfile}
 */
export function buildSampleInshokutenEigyoProfile() {
  return {
    applicantName: "サンプル太郎",
    businessName: "サンプル食堂",
    storeAddress: "東京都サンプル区サンプル1-2-3",
    municipalityName: "東京都",
    phoneNumber: "03-0000-0000",
    shisetsu: {
      sinkCount: 2,
      hasNonTouchHandwashing: true,
      hasWashableWallFloorMaterial: true,
      hasAdequateVentilation: true,
      lightingLux: 200,
      hasProperDrainage: true,
      usesTankOrWellWater: false,
    },
    sekininsha: {
      name: "サンプル花子",
      qualificationType: "調理師",
      isDesignatedPerStore: true,
    },
    plannedOpeningDateIso: "2026-12-01",
  };
}
