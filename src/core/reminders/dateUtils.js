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
