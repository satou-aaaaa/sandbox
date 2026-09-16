/**
 * 廃棄物処理法第14条第5項第2号の欠格事由を判定する。同号は第7条第5項
 * 第4号イ〜チを包含する形で規定されており、単独の号のみを参照する
 * 古物営業法第4条（kobutsu）とは条文構造が異なる点に注意。
 *
 * 参照: e-Gov法令検索「廃棄物の処理及び清掃に関する法律」第14条・第7条
 * （2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/345AC0000000137
 *
 * @param {import('./types.js').SanpaiKekkakuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkSanpaiKekkaku(input) {
  const reasons = [];
  /** @type {[boolean, string][]} */
  const flags = [
    [input.hasMentalImpairmentAffectingDuties, "心身の故障により業務を適切に行うことができないと認められます"],
    [input.isUndischargedBankrupt, "破産手続開始の決定を受けて復権を得ていません"],
    [input.hasCriminalRecordWithin5Years, "拘禁刑以上の刑等により5年を経過していません"],
    [input.hasWasteLawViolationWithin5Years, "廃棄物処理法・浄化槽法違反等による罰金刑から5年を経過していません"],
    [input.hadPermitRevokedWithin5Years, "許可の取消しから5年を経過していません"],
    [
      input.hasBusinessClosureDuringRevocationProcessWithin5Years,
      "許可取消し処分の手続中に事業廃止の届出をしてから5年を経過していません",
    ],
    [input.hasDishonestConductRisk, "業務に関し不正又は不誠実な行為をするおそれがあると認められます"],
    [input.isBoryokudanRelated, "暴力団員、又は暴力団員でなくなってから5年を経過していません"],
  ];
  const anyDisqualifying = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(message);
  }
  if (!anyDisqualifying) reasons.push("欠格事由に該当する項目はありません");

  return {
    key: "sanpaiKekkaku",
    label: "欠格事由に該当しないこと",
    passed: !anyDisqualifying,
    reasons,
    warnings: [],
  };
}
