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
 * 【2026年9月・e-Gov法令検索で確認・拡充】従来は建設業法第8条14号中6号分
 * （実質的には第1・2・7〜10号相当、および総則的な虚偽記載要件）のみを
 * 判定していたが、個人の申請者1名の情報のみで判定可能な号（第3・5・6・14号）
 * を追加した。第4・11〜13号は、申請者本人以外の複数人物（役員・使用人・
 * 法定代理人）ごとの欠格状況の保持が必要で、現行の`ApplicantProfile`型
 * （個人申請者1名を前提）では表現できないため、引き続き対象外とする
 * （`types.js`のKekkakuInput定義コメント参照）。
 *
 * @param {import('../types.js').KekkakuInput} input
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkKekkaku(input) {
  /** @type {[boolean | undefined, string][]} */
  const flags = [
    [input.isUndischargedBankrupt, "破産者で復権を得ていない（第1号）"],
    [input.hadLicenseRevokedWithin5Years, "5年以内に建設業許可を取り消された経験がある（第2号）"],
    [
      input.hasWithdrawnLicenseDuringRevocationHearingWithin5Years,
      "許可取消しの聴聞通知後、取消しを免れるため廃業届出をしてから5年を経過していない（第3号）",
    ],
    [input.hasBusinessSuspensionOrderInEffect, "営業停止命令の停止期間が経過していない（第5号）"],
    [input.hasBusinessProhibitionOrderInEffect, "営業禁止処分の禁止期間が経過していない（第6号）"],
    [input.hasCriminalRecordWithin5Years, "拘禁刑以上の刑、または関連法令違反による罰金刑から5年を経過していない（第7号・第8号）"],
    [input.isBoryokudanMemberOrWithin5Years, "暴力団員である、または脱退から5年を経過していない（第9号）"],
    [input.hasMentalImpairmentAffectingDuties, "心身の故障により建設業を適正に営むことができないと認められる（第10号）"],
    [input.isControlledByBoryokudanMember, "暴力団員等がその事業活動を支配する者である（第14号）"],
    [input.hasFalseOrOmittedStatement, "申請書・添付書類に虚偽の記載、または重要な事実の記載漏れがある"],
  ];

  const hits = flags.filter(([flag]) => flag).map(([, label]) => label);
  const passed = hits.length === 0;

  const reasons = passed
    ? [
        "欠格要件（建設業法第8条各号: 破産・許可取消歴・駆け込み廃業・営業停止/禁止処分中・刑罰・" +
          "暴力団関係・心身の故障・虚偽記載）のいずれにも該当しません",
      ]
    : hits.map((h) => `欠格要件に該当: ${h}`);

  return {
    key: "kekkaku",
    label: "欠格要件に該当しないこと",
    passed,
    reasons,
    warnings: [],
  };
}
