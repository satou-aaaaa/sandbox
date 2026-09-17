/**
 * 特定技能1号の在留期限満了リマインド、および通算在留期間5年上限の
 * 接近警告リマインドを算出する。gijinkoku-coreのcalcZairyuKikanSchedule
 * （満了日を直接入力として受け取る「可変期間の有効期限型」）を土台に、
 * 通算5年上限という第2のリマインド軸を同じScheduleItem[]に混在させる。
 * コアのScheduleFn契約（LicenseEntry → ScheduleItem[]）は変更しない。
 *
 * 【通算5年上限について】出入国管理及び難民認定法をe-Gov法令検索で
 * 確認したところ、「通算」という語自体は同法の条文中には見当たらず、
 * 特定技能1号の通算5年上限は同法第2条の3が政府に策定を義務付ける
 * 「基本方針」（分野別運用方針を含む運用レベルの指針）で定められている
 * ものと考えられる（2026年9月確認）。制度の存在自体は出入国在留管理庁の
 * 公表資料で広く確認できる確立した運用だが、法律本文の特定の条番号を
 * 直接の根拠として引用できないため、本コードでは条文引用をせず「運用上
 * 5年が上限とされている」という前提で近似計算を行う。
 *
 * 【注意】通算在留期間の正確な計算方法（出国期間・特例期間の扱い、
 * 30日未満の端数の扱い）は実装時点で一次資料確認が完了していない。
 * 以下は簡易な暦年加算による近似計算であり、正確な計算が必要な個別
 * ケースでは人手確認を促す。
 */

/**
 * @typedef {Object} TokuteiGinouLicenseDetail LicenseEntry.tokuteiGinouDetail の中身
 *   （CSVの列としては持たせない。他モジュールの<種別>Detailと同じ設計）
 * @property {string} [fieldKey] 対象の特定産業分野キー（fieldRegistryのキーと対応）
 * @property {string} [expiryDateIso] 在留カード記載の在留期限（YYYY-MM-DD）
 * @property {string} [cumulativeStayStartDateIso]
 *   通算在留期間の起算日（初回上陸日等）。5年上限の到達見込み日の計算に使う。
 *   起算日の正確な決定方法は一次資料確認が必要
 * @property {boolean} [supportOutsourced] 支援計画の委託有無（true: 全部または一部委託）
 * @property {string} [registeredSupportOrgName] 委託先の登録支援機関名（委託ありの場合）
 */

/**
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { tokuteiGinouDetail?: TokuteiGinouLicenseDetail }} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcTokuteiGinouSchedule(license) {
  const detail = license.tokuteiGinouDetail;
  if (!detail) return [];

  const items = [];

  if (detail.expiryDateIso) {
    items.push(
      { type: "zairyu-early-notice", label: "在留期間更新の早期検討（満了90日前）", dueDateIso: addDaysIso(detail.expiryDateIso, -90) },
      { type: "zairyu-prepare", label: "更新申請の推奨開始日（満了60日前）", dueDateIso: addDaysIso(detail.expiryDateIso, -60) },
      { type: "zairyu-deadline", label: "更新申請の目安締切（満了30日前）", dueDateIso: addDaysIso(detail.expiryDateIso, -30) }
    );
  }

  if (detail.cumulativeStayStartDateIso) {
    const capDateIso = calcGonenJougenDate(detail.cumulativeStayStartDateIso);
    items.push({
      type: "gonen-jougen-keikoku",
      label: "通算在留期間5年上限の到達見込み日（簡易計算・特定技能2号移行等の検討要）",
      dueDateIso: addDaysIso(capDateIso, -180), // 上限180日前から警告を出す（早期の方針検討を促すための余裕）
    });
  }

  return items;
}

/**
 * 通算在留期間の起算日から、5年上限の到達見込み日を暦年加算で近似計算する。
 * @param {string} startDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcGonenJougenDate(startDateIso) {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y + 5, m - 1, d));
  return date.toISOString().slice(0, 10);
}

/**
 * 次回更新の候補期限が通算5年の上限を超えるかどうかを判定する（FR-T4.3）。
 * @param {string} cumulativeStayStartDateIso
 * @param {string} candidateNextExpiryDateIso
 * @returns {{ exceedsCap: boolean, capDateIso: string }}
 */
export function checkExceedsGonenJougen(cumulativeStayStartDateIso, candidateNextExpiryDateIso) {
  const capDateIso = calcGonenJougenDate(cumulativeStayStartDateIso);
  return { exceedsCap: candidateNextExpiryDateIso > capDateIso, capDateIso };
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const DAY_MS = 24 * 60 * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}
