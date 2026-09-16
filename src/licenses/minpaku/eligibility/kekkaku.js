/**
 * 住宅宿泊事業法第4条の欠格事由を判定する。
 *
 * 参照: e-Gov法令検索「住宅宿泊事業法」第4条（2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/429AC0000000065
 *
 * @param {import('./types.js').MinpakuKekkakuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkMinpakuKekkaku(input) {
  const reasons = [];
  /** @type {[boolean, string][]} */
  const flags = [
    [input.hasMentalOrPhysicalImpairment, "心身の故障により住宅宿泊事業を的確に遂行することができないと認められます（第1号）"],
    [input.isUndischargedBankrupt, "破産手続開始の決定を受けて復権を得ていません（第2号）"],
    [
      input.hadBusinessSuspensionOrderWithin3Years,
      "住宅宿泊事業の廃止命令を受けてから3年を経過していません（第3号）",
    ],
    [
      input.hasCriminalRecordWithin3Years,
      "拘禁刑以上の刑、又は本法・旅館業法違反の罰金刑から3年を経過していません（第4号）",
    ],
    [input.isBoryokudanRelated, "暴力団員、又は暴力団員でなくなってから5年を経過していません（第5号）"],
  ];
  const anyDisqualifying = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(message);
  }
  if (!anyDisqualifying) reasons.push("欠格事由に該当する項目はありません");

  return {
    key: "minpakuKekkaku",
    label: "欠格事由に該当しないこと",
    passed: !anyDisqualifying,
    reasons,
    warnings: [],
  };
}
