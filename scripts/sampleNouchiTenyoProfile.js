/**
 * 農地転用許可の書類生成サンプルスクリプト共通のダミー申請者データ。
 * 実在の顧客・農地データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/licenses/nouchi-tenyo/eligibility/types.js').NouchiTenyoApplicantProfile}
 */
export function buildSampleNouchiTenyoProfile() {
  return {
    article: "4条",
    applicantName: "サンプル建設株式会社",
    address: "愛知県名古屋市中区三の丸1-1-1",
    landAddress: "愛知県〇〇市〇〇町字〇〇100番地",
    landAreaSqm: 500,
    purposeOfConversion: "資材置場",
    ricchiKijun: {
      nouchiKubun: "第3種農地",
    },
    ippanKijun: {
      hasSufficientFundsAndCredit: true,
      hasConstructionSchedule: true,
      hasNeighborDamagePreventionMeasures: true,
      hasNeighborConsent: true,
    },
    shikinChotatsu: [
      { kubun: "自己資金", amountYen: 3_000_000 },
      { kubun: "金融機関借入", amountYen: 2_000_000, note: "融資内諾書取得済み" },
    ],
  };
}
