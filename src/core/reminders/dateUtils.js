/**
 * 許可種別に依存しない日付計算ユーティリティ。
 *
 * `daysUntil` は元々 `src/reminders/renewalSchedule.js`（建設業許可専用の
 * 期限計算モジュール）に置かれていたが、許可種別に依存しない純粋な日数計算
 * であるため、1章の設計原則「コアは許可種別を知らない」に沿ってこちらへ
 * 移した（docs/DESIGN_kobutsu-core.md 5.3節参照）。
 * `src/licenses/construction/reminders/renewalSchedule.js` は本モジュールから
 * `daysUntil` を再エクスポートし、既存の呼び出し元との互換性を保つ。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * 指定日から単純な暦日加算（月単位の丸めは行わない）をした日付を返す。
 * 「変更日から14日以内」のような、月をまたいでも日数がそのまま加算される
 * 期限計算で使う（月単位の丸めが必要な場合は`expirySchedule.js`の
 * `addMonthsClamped`を使うこと。両者は用途が異なるため統合しない）。
 *
 * 【2026年9月・重複解消】許可種別に依存しない純粋な日付計算であるにも
 * かかわらず、gijinkoku・kobutsu・tokutei-ginou・successionの4モジュールが
 * それぞれ同じ内容を独立に再実装していたため、1章の設計原則「コアは
 * 許可種別を知らない」に沿ってこちらへ集約した（`daysUntil`と同じ経緯）。
 *
 * @param {string} iso YYYY-MM-DD
 * @param {number} days 負の値を渡すと過去の日付を計算できる
 * @returns {string} YYYY-MM-DD
 */
export function addDaysIso(iso, days) {
  const date = parseIsoDate(iso);
  return toIsoDate(new Date(date.getTime() + days * DAY_MS));
}

/**
 * 指定日から単純な年加算（うるう年の2/29に対する月末クランプは行わない）を
 * した日付を返す。産廃許可の講習修了証の有効期限（5年後）計算で使う。
 *
 * 【2026年9月・重複解消】`src/licenses/sanpai/eligibility/koushu.js`と
 * `src/licenses/sanpai/reminders/renewalAndKoushuSchedule.js`が同じ内容を
 * 独立に再実装していたため`addDaysIso`と同じ経緯でこちらへ集約した。
 *
 * @param {string} iso YYYY-MM-DD
 * @param {number} years
 * @returns {string} YYYY-MM-DD
 */
export function addYearsIso(iso, years) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
