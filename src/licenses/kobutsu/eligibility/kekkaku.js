/**
 * 古物営業法第4条の欠格事由を判定する（一号〜九号。十号・十一号は
 * 対象外。docs/DESIGN_kobutsu-core.md 4.3節・
 * docs/REQUIREMENTS_kobutsu-core.md 8.1節参照）。
 * 参照: e-Gov法令検索「古物営業法」第4条（2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/324AC0000000108
 *
 * @param {import('./types.js').KobutsuKekkakuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKobutsuKekkaku(input) {
  const reasons = [];
  /** @type {[boolean, string][]} */
  const flags = [
    [input.isUndischargedBankrupt, "破産手続開始の決定を受けて復権を得ていません"],
    [input.hasCriminalRecordWithin5Years, "拘禁刑以上の刑等により5年を経過していません"],
    [input.hasBoryokuFuhouKoiRisk, "集団的・常習的な暴力的不法行為等のおそれがあると認められます"],
    [input.hasBoryokudanRelatedOrderWithin3Years, "暴力団関連の命令・指示を受けてから3年を経過していません"],
    [input.isAddressUnknown, "住居が定まっていません"],
    [input.hadLicenseRevokedWithin5Years, "許可の取消しから5年を経過していません"],
    [
      input.hasSurrenderedLicenseDuringRevocationHearingWithin5Years,
      "許可取消しの聴聞公示後に許可証を返納してから5年を経過していません",
    ],
    [input.hasMentalImpairmentAffectingDuties, "心身の故障により業務を適正に行うことができないと認められます"],
    [
      input.isMinorWithoutCapacity && !input.isHeirWithQualifiedLegalRepresentative,
      "未成年者であり、例外規定（古物商・古物市場主の相続人としての例外）にも該当しません",
    ],
  ];
  const anyDisqualifying = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(message);
  }
  if (!anyDisqualifying) reasons.push("欠格事由に該当する項目はありません");

  return {
    key: "kobutsuKekkaku",
    label: "欠格事由に該当しないこと",
    passed: !anyDisqualifying,
    reasons,
    warnings: [],
  };
}
