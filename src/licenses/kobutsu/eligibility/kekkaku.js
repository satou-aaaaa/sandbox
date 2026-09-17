/**
 * 古物営業法第4条の欠格事由を判定する（一号〜九号、および法人申請の
 * 場合は十一号〈法人役員の欠格〉も対象。十号は対象外。
 * docs/DESIGN_kobutsu-core.md 4.3節・docs/REQUIREMENTS_kobutsu-core.md 8.1節参照）。
 * 参照: e-Gov法令検索「古物営業法」第4条（2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/324AC0000000108
 *
 * 【2026年9月・第十一号対応】法人でその役員のうちに第一号から第八号までの
 * いずれかに該当する者があるものは許可基準に抵触する（十一号）。
 * `officers`（法人申請の場合のみ）を渡すと、申請者本人の一号〜九号の判定に
 * 加えて、役員ごとの一号〜八号該当性もあわせて判定する。
 *
 * @param {import('./types.js').KobutsuKekkakuInput} input
 * @param {import('./types.js').KobutsuOfficerInput[]} [officers] 法人申請の場合の役員一覧
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKobutsuKekkaku(input, officers) {
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
  for (const officer of officers ?? []) {
    flags.push(
      [officer.isUndischargedBankrupt, `役員（${officer.name}）が破産手続開始の決定を受けて復権を得ていません（第十一号）`],
      [officer.hasCriminalRecordWithin5Years, `役員（${officer.name}）が拘禁刑以上の刑等により5年を経過していません（第十一号）`],
      [
        officer.hasBoryokuFuhouKoiRisk,
        `役員（${officer.name}）に集団的・常習的な暴力的不法行為等のおそれがあると認められます（第十一号）`,
      ],
      [
        officer.hasBoryokudanRelatedOrderWithin3Years,
        `役員（${officer.name}）が暴力団関連の命令・指示を受けてから3年を経過していません（第十一号）`,
      ],
      [officer.isAddressUnknown, `役員（${officer.name}）の住居が定まっていません（第十一号）`],
      [officer.hadLicenseRevokedWithin5Years, `役員（${officer.name}）が許可の取消しから5年を経過していません（第十一号）`],
      [
        officer.hasSurrenderedLicenseDuringRevocationHearingWithin5Years,
        `役員（${officer.name}）が許可取消しの聴聞公示後に許可証を返納してから5年を経過していません（第十一号）`,
      ],
      [
        officer.hasMentalImpairmentAffectingDuties,
        `役員（${officer.name}）が心身の故障により業務を適正に行うことができないと認められます（第十一号）`,
      ]
    );
  }
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
