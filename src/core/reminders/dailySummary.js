/**
 * リマインドの日次点検用の要約（件数と最短期限のみ。クライアント名・許可の詳細は含めない）。
 *
 * 通知・ログに載せても個人情報が漏れないよう、名前を一切含まない形にする。全文（クライアント名つき）は
 * ローカルファイルにだけ保存する（scripts/reminders-daily.js。ADR-0018。DESIGN.md 1章「外部送信をしない」）。
 */

/**
 * @param {import('./digest.js').ReminderAlert[]} alerts buildReminderDigest の結果（期限が近い順）
 * @returns {{overdue: number, within7: number, within30: number, total: number, nearestDueDateIso: string | null, nearestDaysUntil: number | null, line: string}}
 */
export function summarizeAlertsForNotification(alerts) {
  const overdue = alerts.filter((a) => a.daysUntil < 0).length;
  const within7 = alerts.filter((a) => a.daysUntil >= 0 && a.daysUntil <= 7).length;
  const within30 = alerts.filter((a) => a.daysUntil > 7 && a.daysUntil <= 30).length;
  // 期限が近い順に並んでいる前提だが、順序に依存しないよう最小値を取る
  const nearest = alerts.reduce((min, a) => (min === null || a.daysUntil < min.daysUntil ? a : min), /** @type {import('./digest.js').ReminderAlert | null} */ (null));
  const nearestText = nearest
    ? `最短 ${nearest.dueDateIso}（${nearest.daysUntil < 0 ? `${-nearest.daysUntil}日超過` : `あと${nearest.daysUntil}日`}）`
    : "リマインド項目なし";
  return {
    overdue,
    within7,
    within30,
    total: alerts.length,
    nearestDueDateIso: nearest?.dueDateIso ?? null,
    nearestDaysUntil: nearest?.daysUntil ?? null,
    line: `期限超過 ${overdue}件／7日以内 ${within7}件／30日以内 ${within30}件／${nearestText}`,
  };
}
