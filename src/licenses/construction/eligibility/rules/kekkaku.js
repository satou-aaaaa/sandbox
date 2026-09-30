/**
 * 要件4: 欠格要件に該当しないこと
 *
 * 1つでも該当すれば不許可となる「ネガティブリスト」形式の要件。
 * 誠実性（seijitsusei.js）とは別モジュールだが、性質が近いので
 * engine.js では両方をまとめて「その他の要件」として扱う。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 * 建設業法第8条・同法施行令第3条（e-Gov法令検索。2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/324AC0000000100
 * https://laws.e-gov.go.jp/law/331CO0000000273
 *
 * 【2026年9月・全14号対応】本人分の10項目（第1・2・3・5・6・7〜8・9・10・14号、
 * および総則的な虚偽記載要件）に加え、次の3件を追加してGitHub Issue #72の
 * 対象である建設業法第8条の全14号に対応した。
 * - 第4号（取消し通知前60日以内に役員等であった者。本人分に追加）
 * - 第11号（未成年者の法定代理人の欠格。`legalRepresentativeKekkaku`）
 * - 第12号・第13号（法人役員等・政令で定める使用人の欠格。`officers[].kekkaku`・
 *   `regulatoryEmployees[].kekkaku`）
 * 役員・使用人・法定代理人の欠格情報が入力されていない場合でも判定結果を
 * 「合格」に固定はせず、`warnings`で未確認である旨を明示する
 * （CLAUDE.mdの「判定の合否を曖昧にフォールバックさせない」方針）。
 *
 * @param {import('../types.js').PersonKekkakuInput | undefined} person
 * @param {string} roleLabel 理由文に出す肩書き＋氏名（例: "役員（山田太郎）"）
 * @param {string} article 号の表記（例: "第十二号"）
 * @returns {[boolean | undefined, string][]}
 */
function buildPersonFlags(person, roleLabel, article) {
  if (!person) return [];
  return [
    [person.isUndischargedBankrupt, `${roleLabel}が破産者で復権を得ていません（${article}）`],
    [person.hadLicenseRevokedWithin5Years, `${roleLabel}が5年以内に建設業許可を取り消された経験があります（${article}）`],
    [
      person.hasWithdrawnLicenseDuringRevocationHearingWithin5Years,
      `${roleLabel}が許可取消しの聴聞通知後、取消しを免れるため廃業届出をしてから5年を経過していません（${article}）`,
    ],
    [
      person.hasRevocationNoticeWithin60DaysAsOfficer,
      `${roleLabel}が許可取消しの聴聞通知前60日以内に当該法人の役員等でした（${article}）`,
    ],
    [person.hasBusinessProhibitionOrderInEffect, `${roleLabel}が営業禁止処分の禁止期間中です（${article}）`],
    [person.hasCriminalRecordWithin5Years, `${roleLabel}が拘禁刑以上の刑等から5年を経過していません（${article}）`],
    [person.isBoryokudanMemberOrWithin5Years, `${roleLabel}が暴力団員である、または脱退から5年を経過していません（${article}）`],
    [
      person.hasMentalImpairmentAffectingDuties,
      `${roleLabel}が心身の故障により業務を適正に行うことができないと認められます（${article}）`,
    ],
  ];
}

/**
 * @param {import('../types.js').KekkakuInput} input 申請者本人の欠格事由
 * @param {import('../types.js').OfficerInput[]} [officers] 役員等の一覧（法人の場合。第12号判定用）
 * @param {import('../types.js').RegulatoryEmployeeInput[]} [regulatoryEmployees] 政令で定める使用人の一覧（第12号〈法人〉・第13号〈個人〉判定用）
 * @param {"法人" | "個人"} [applicantType] 申請者の種別（省略時は法人として扱う）
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkKekkaku(input, officers, regulatoryEmployees, applicantType) {
  const employeeArticle = applicantType === "個人" ? "第十三号" : "第十二号";

  /** @type {[boolean | undefined, string][]} */
  const flags = [
    [input.isUndischargedBankrupt, "破産者で復権を得ていない（第1号）"],
    [input.hadLicenseRevokedWithin5Years, "5年以内に建設業許可を取り消された経験がある（第2号）"],
    [
      input.hasWithdrawnLicenseDuringRevocationHearingWithin5Years,
      "許可取消しの聴聞通知後、取消しを免れるため廃業届出をしてから5年を経過していない（第3号）",
    ],
    [
      input.hasRevocationNoticeWithin60DaysAsOfficer,
      "許可取消しの聴聞通知前60日以内に当該法人の役員等であった（第4号）",
    ],
    [input.hasBusinessSuspensionOrderInEffect, "営業停止命令の停止期間が経過していない（第5号）"],
    [input.hasBusinessProhibitionOrderInEffect, "営業禁止処分の禁止期間が経過していない（第6号）"],
    [input.hasCriminalRecordWithin5Years, "拘禁刑以上の刑、または関連法令違反による罰金刑から5年を経過していない（第7号・第8号）"],
    [input.isBoryokudanMemberOrWithin5Years, "暴力団員である、または脱退から5年を経過していない（第9号）"],
    [input.hasMentalImpairmentAffectingDuties, "心身の故障により建設業を適正に営むことができないと認められる（第10号）"],
    ...(input.isMinor ? buildPersonFlags(input.legalRepresentativeKekkaku, input.legalRepresentativeName ? `法定代理人（${input.legalRepresentativeName}）` : "法定代理人", "第十一号") : []),
    [input.isControlledByBoryokudanMember, "暴力団員等がその事業活動を支配する者である（第14号）"],
    [input.hasFalseOrOmittedStatement, "申請書・添付書類に虚偽の記載、または重要な事実の記載漏れがある"],
  ];

  for (const officer of officers ?? []) {
    flags.push(...buildPersonFlags(officer.kekkaku, `役員（${officer.name}）`, "第十二号"));
  }
  for (const employee of regulatoryEmployees ?? []) {
    flags.push(...buildPersonFlags(employee.kekkaku, `政令で定める使用人（${employee.name}）`, employeeArticle));
  }

  const hits = flags.filter(([flag]) => flag).map(([, label]) => label);
  const passed = hits.length === 0;

  const reasons = passed
    ? [
        "欠格要件（建設業法第8条各号: 破産・許可取消歴・駆け込み廃業・営業停止/禁止処分中・刑罰・" +
          "暴力団関係・心身の故障・虚偽記載、および役員等・政令使用人・法定代理人の欠格〈入力がある範囲〉）" +
          "のいずれにも該当しません",
      ]
    : hits.map((h) => `欠格要件に該当: ${h}`);

  const warnings = [];
  if (input.isMinor && !input.legalRepresentativeKekkaku) {
    warnings.push("申請者が未成年者ですが、法定代理人の欠格事由（第十一号）が未入力です。行政書士本人が確認してください。");
  }
  if (officers?.length && officers.every((o) => !o.kekkaku)) {
    warnings.push("役員の欠格事由（第十二号）が未入力です。行政書士本人が役員ごとに確認してください。");
  }
  if (regulatoryEmployees?.length && regulatoryEmployees.every((e) => !e.kekkaku)) {
    warnings.push(`政令で定める使用人の欠格事由（${employeeArticle}）が未入力です。行政書士本人が使用人ごとに確認してください。`);
  }

  return {
    key: "kekkaku",
    label: "欠格要件に該当しないこと",
    passed,
    reasons,
    warnings,
  };
}
