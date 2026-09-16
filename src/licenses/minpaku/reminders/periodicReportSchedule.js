/**
 * 民泊の定期報告（宿泊実績）リマインドを計算する。
 *
 * 【法令確認による設計変更】当初案は「直近の報告日（または届出日）を起点に
 * 2ヶ月ごとに繰り返す」という動的計算だったが、一次資料確認の結果これは
 * 誤りだったと判明した。住宅宿泊事業法施行規則第12条第2項（e-Gov法令検索で
 * 原文確認済み・2026年9月）は「毎年2・4・6・8・10・12月の15日までに、
 * それぞれの月の前2ヶ月分をまとめて報告する」という暦日固定制を定めており、
 * 次回期限は報告実績・届出日に一切依存しない（docs/DESIGN_minpaku-core.md
 * 4.3節参照）。そのため、当初設計していた報告実績記録用の
 * `recordMinpakuReport` 関数は不要になった。
 */

/** 施行規則第12条第2項で定める、報告期限の月（1-12）。日は毎回15日固定。 */
const REPORT_DEADLINE_MONTHS = [2, 4, 6, 8, 10, 12];

/**
 * 基準日以降で最初に到来する定期報告の期限（毎年2/4/6/8/10/12月15日の
 * いずれか）を計算する。前回の報告実績日には一切依存しない
 * （施行規則第12条第2項が暦日固定のため）。
 *
 * @param {string} baseDateIso 基準日（YYYY-MM-DD）
 * @returns {string}
 */
export function calcNextReportDeadline(baseDateIso) {
  const [y, m, d] = baseDateIso.split("-").map(Number);
  for (const month of REPORT_DEADLINE_MONTHS) {
    if (m < month || (m === month && d <= 15)) {
      return `${y}-${String(month).padStart(2, "0")}-15`;
    }
  }
  // 今年の12/15をすでに過ぎている場合は、翌年2/15が次回期限
  return `${y + 1}-02-15`;
}

/**
 * @typedef {Object} MinpakuLicenseDetail 民泊届出のクライアント側追加情報
 *   （`LicenseEntry.minpakuDetail` の中身。CSVの列としては持たせない）
 * @property {string} [notificationDateIso] 届出日（YYYY-MM-DD）。未設定＝まだ届出前で報告義務なし
 */

/**
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { minpakuDetail?: MinpakuLicenseDetail }} license
 *   `license.minpakuDetail.notificationDateIso` は「報告義務が発生しているか」の
 *   ゲートとしてのみ使う。次回期限そのものは暦日テーブルの参照のため、常に
 *   「本日」を基準に計算する（起点を届出日に固定すると、最初のサイクルから
 *   先に進まなくなるバグになるため。docs/DESIGN_minpaku-core.md 4.3節参照）
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcMinpakuSchedule(license) {
  const detail = license.minpakuDetail;
  if (!detail?.notificationDateIso) return [];
  const todayIso = new Date().toISOString().slice(0, 10);
  return [
    {
      type: "minpaku-periodic-report",
      label: "定期報告（宿泊実績）の次回期限",
      dueDateIso: calcNextReportDeadline(todayIso),
    },
  ];
}
