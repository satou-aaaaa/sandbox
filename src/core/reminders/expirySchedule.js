/**
 * 「満了日ベース」の更新リマインド一式（早期検討・準備開始・最終締切・満了日）を
 * 算出する、許可種別に依存しない汎用ロジック。
 *
 * 元々は建設業許可専用の `src/licenses/construction/reminders/renewalSchedule.js`
 * に「有効期間5年固定」でハードコードされていたが、産業廃棄物収集運搬業許可の
 * 実装にあたり法令（廃棄物処理法施行令第6条の9）を確認したところ、有効期間が
 * 一律5年ではなく「新規許可: 5年」「更新時、優良認定基準に適合: 7年」
 * 「適合しない場合: 5年」の3区分であることが判明した。建設業許可用の関数は
 * 有効期間を引数化していなかったため7年のケースを表現できず、月単位丸め計算
 * ロジック自体をここへ切り出し、有効期間（年数）を引数に取れるようにした
 * （docs/DESIGN_sanpai-core.md 4.3節参照）。
 *
 * 建設業許可の `calcLicenseExpiry` / `calcRenewalSchedule` は、この関数を
 * `validityYears: 5` で呼び出す薄いラッパーとして残しており、既存の
 * 呼び出し元・出力値に変更はない。
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
 * 「許可のあった日から `validityYears` 年を経過する日の前日まで」が有効期間。
 *
 * @param {string} grantDateIso 許可年月日（YYYY-MM-DD）
 * @param {number} validityYears 有効期間（年）
 * @returns {string} 満了日（YYYY-MM-DD）
 */
export function calcExpiry(grantDateIso, validityYears) {
  const grant = parseIsoDate(grantDateIso);
  const yearsLater = addMonthsClamped(grant, validityYears * 12);
  const expiry = new Date(yearsLater.getTime() - DAY_MS);
  return toIsoDate(expiry);
}

/**
 * 更新申請の推奨提出期限（満了日の30日前）を計算する。
 * 実務上は余裕を持って60日前を「準備開始リマインド」とし、30日前を「最終締切リマインド」とする。
 * また、満了180日前を「早期の準備検討リマインド」として算出する（実務上の目安であり法令上の期限ではない）。
 *
 * @param {string} grantDateIso
 * @param {number} validityYears 有効期間（年）
 * @returns {{ expiryDate: string, earlyNoticeDate: string, recommendedStartDate: string, hardDeadline: string }}
 */
export function calcExpirySchedule(grantDateIso, validityYears) {
  const expiryDate = calcExpiry(grantDateIso, validityYears);
  const expiry = parseIsoDate(expiryDate);
  const hardDeadline = toIsoDate(new Date(expiry.getTime() - 30 * DAY_MS));
  const recommendedStartDate = toIsoDate(new Date(expiry.getTime() - 60 * DAY_MS));
  const earlyNoticeDate = toIsoDate(new Date(expiry.getTime() - 180 * DAY_MS));
  return { expiryDate, earlyNoticeDate, recommendedStartDate, hardDeadline };
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
