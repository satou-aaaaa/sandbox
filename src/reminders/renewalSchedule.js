/**
 * 建設業許可の「更新リマインドエンジン」。
 *
 * 許可の有効期間は5年間で、更新申請は満了日の30日前までに行う必要がある。
 * また毎事業年度終了後4ヶ月以内に「決算変更届（事業年度終了届）」の提出が必要で、
 * これを怠ると更新時に受理されないことがある。
 * この2つの期限を自動計算し、クライアントへのリマインドタイミングを算出する。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 日付に「月単位」でオフセットを加算する。対象月に同じ日が存在しない場合
 * （例: 1/31 + 1ヶ月 → 2月31日は存在しない）は、対象月の末日に丸める。
 * 日本の行政手続の期限計算（「〜ヶ月以内」「〜年を経過する日」）で一般的な扱いに合わせている。
 *
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonthsClamped(date, months) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetMonthIndex = m + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  return new Date(Date.UTC(y, targetMonthIndex, day));
}

/**
 * 許可の有効期間満了日を計算する。
 * 「許可のあった日から5年を経過する日の前日まで」が有効期間。
 *
 * @param {string} grantDateIso 許可年月日（YYYY-MM-DD）
 * @returns {string} 満了日（YYYY-MM-DD）
 */
export function calcLicenseExpiry(grantDateIso) {
  const grant = parseIsoDate(grantDateIso);
  const fiveYearsLater = addMonthsClamped(grant, 60);
  const expiry = new Date(fiveYearsLater.getTime() - DAY_MS);
  return toIsoDate(expiry);
}

/**
 * 更新申請の推奨提出期限（満了日の30日前）を計算する。
 * 実務上は余裕を持って60日前を「準備開始リマインド」とし、30日前を「最終締切リマインド」とする。
 * また、業界標準（競合調査。`docs/PROPOSAL.md` M7参照）に合わせ、満了180日前を
 * 「早期の準備検討リマインド」として算出する。60日前と同様、これはあくまで
 * 実務上の目安（早めの声かけ用バッファ）であり、法令上の期限ではない
 * （`hardDeadline`＝30日前のみが建設業法上の法定期限であり、この値は変更しない）。
 *
 * @param {string} grantDateIso
 * @returns {{ expiryDate: string, earlyNoticeDate: string, recommendedStartDate: string, hardDeadline: string }}
 */
export function calcRenewalSchedule(grantDateIso) {
  const expiryDate = calcLicenseExpiry(grantDateIso);
  const expiry = parseIsoDate(expiryDate);
  const hardDeadline = toIsoDate(new Date(expiry.getTime() - 30 * DAY_MS));
  const recommendedStartDate = toIsoDate(new Date(expiry.getTime() - 60 * DAY_MS));
  const earlyNoticeDate = toIsoDate(new Date(expiry.getTime() - 180 * DAY_MS));
  return { expiryDate, earlyNoticeDate, recommendedStartDate, hardDeadline };
}

/**
 * 決算変更届（事業年度終了届）の提出期限を計算する。
 * 「事業年度終了後4ヶ月以内」。
 *
 * @param {string} fiscalYearEndIso 事業年度終了日（YYYY-MM-DD）
 * @returns {string} 提出期限（YYYY-MM-DD）
 */
export function calcKessanHenkoDeadline(fiscalYearEndIso) {
  const end = parseIsoDate(fiscalYearEndIso);
  const deadline = addMonthsClamped(end, 4);
  return toIsoDate(deadline);
}

/**
 * ある基準日時点で、指定日までの残り日数を計算する。
 * 通知バッチ処理（例: 「残り30日を切ったらリマインドを送る」）で使う想定。
 *
 * @param {string} targetDateIso
 * @param {string} [fromDateIso] 省略時は本日
 * @returns {number} 残り日数（負の場合は既に過ぎている）
 */
export function daysUntil(targetDateIso, fromDateIso) {
  const target = parseIsoDate(targetDateIso);
  const from = fromDateIso ? parseIsoDate(fromDateIso) : new Date(toIsoDate(new Date()));
  return Math.round((target.getTime() - from.getTime()) / DAY_MS);
}

/** @param {string} iso */
function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** @param {Date} date */
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}
