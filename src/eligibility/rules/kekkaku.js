/**
 * 要件4: 欠格要件に該当しないこと
 *
 * 1つでも該当すれば不許可となる「ネガティブリスト」形式の要件。
 * 誠実性（seijitsusei.js）とは別モジュールだが、性質が近いので
 * engine.js では両方をまとめて「その他の要件」として扱う。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 *
 * @param {import('../types.js').KekkakuInput} input
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkKekkaku(input) {
  /** @type {[boolean, string][]} */
  const flags = [
    [input.isUndischargedBankrupt, "破産者で復権を得ていない"],
    [input.hadLicenseRevokedWithin5Years, "5年以内に建設業許可を取り消された経験がある"],
    [input.hasCriminalRecordWithin5Years, "禁錮以上の刑、または関連法令違反による罰金刑から5年を経過していない"],
    [input.isBoryokudanMemberOrWithin5Years, "暴力団員である、または脱退から5年を経過していない"],
    [input.hasMentalImpairmentAffectingDuties, "心身の故障により建設業を適正に営むことができないと認められる"],
    [input.hasFalseOrOmittedStatement, "申請書・添付書類に虚偽の記載、または重要な事実の記載漏れがある"],
  ];

  const hits = flags.filter(([flag]) => flag).map(([, label]) => label);
  const passed = hits.length === 0;

  const reasons = passed
    ? ["欠格要件（破産・許可取消歴・刑罰・暴力団関係・心身の故障・虚偽記載）のいずれにも該当しません"]
    : hits.map((h) => `欠格要件に該当: ${h}`);

  return {
    key: "kekkaku",
    label: "欠格要件に該当しないこと",
    passed,
    reasons,
    warnings: [],
  };
}
