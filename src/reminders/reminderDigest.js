/**
 * M4（通知連携）の土台となる「リマインド・ダイジェスト」計算。
 *
 * 【スコープ】本モジュールが行うのは、複数クライアントの許可情報から
 * 「今どのリマインドが必要か」を集計・整形することまで。実際のメール等の
 * 自動送信は行わない（通知チャネルの選定は発注者側の意思決定が必要であり、
 * 外部サービス連携が前提になるためNFR-2・NFR-4との整合を要する。
 * 詳細は docs/DESIGN.md 9章を参照）。
 *
 * 日付計算そのものは新規実装せず、既存の src/reminders/renewalSchedule.js
 * （calcRenewalSchedule / calcKessanHenkoDeadline / daysUntil）をそのまま
 * 再利用する。
 */
import { calcRenewalSchedule, calcKessanHenkoDeadline, daysUntil } from "./renewalSchedule.js";

/**
 * @typedef {Object} ClientLicenseRecord クライアント1件分の許可情報
 * @property {string} clientName クライアント名（会社名 or 個人名）
 * @property {string} grantDateIso 許可年月日（YYYY-MM-DD）
 * @property {string} [fiscalYearEndIso] 直近の事業年度終了日（YYYY-MM-DD、任意。
 *   指定した場合のみ決算変更届のリマインドを計算する）
 */

/**
 * @typedef {Object} ReminderAlert 1件のリマインド項目
 * @property {string} clientName
 * @property {"renewal-prepare" | "renewal-deadline" | "kessan-henko"} type
 * @property {string} label 人間可読なラベル
 * @property {string} dueDateIso 期限日（YYYY-MM-DD）
 * @property {number} daysUntil 基準日から期限日までの残り日数（負なら期限超過）
 * @property {boolean} isOverdue 期限を過ぎているか
 */

/**
 * クライアント一覧から、リマインド項目の一覧を計算する。
 * 期限が近い順（daysUntil昇順。期限超過が先頭）にソートして返す。
 *
 * @param {ClientLicenseRecord[]} records
 * @param {string} [todayIso] 基準日（YYYY-MM-DD）。省略時は本日
 * @returns {ReminderAlert[]}
 */
export function buildReminderDigest(records, todayIso) {
  const alerts = [];
  for (const record of records) {
    const schedule = calcRenewalSchedule(record.grantDateIso);
    alerts.push(
      makeAlert(record.clientName, "renewal-prepare", "更新準備開始の推奨日（満了60日前）", schedule.recommendedStartDate, todayIso)
    );
    alerts.push(
      makeAlert(record.clientName, "renewal-deadline", "更新申請の最終締切（満了30日前）", schedule.hardDeadline, todayIso)
    );
    if (record.fiscalYearEndIso) {
      const kessanDeadline = calcKessanHenkoDeadline(record.fiscalYearEndIso);
      alerts.push(makeAlert(record.clientName, "kessan-henko", "決算変更届の提出期限", kessanDeadline, todayIso));
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** @returns {ReminderAlert} */
function makeAlert(clientName, type, label, dueDateIso, todayIso) {
  const days = daysUntil(dueDateIso, todayIso);
  return { clientName, type, label, dueDateIso, daysUntil: days, isOverdue: days < 0 };
}

/**
 * 「今すぐ確認すべき」リマインドだけに絞り込む（期限超過を含む、指定日数以内のもの）。
 * @param {ReminderAlert[]} alerts
 * @param {{ withinDays?: number }} [options] withinDaysのデフォルトは30
 * @returns {ReminderAlert[]}
 */
export function filterDueAlerts(alerts, { withinDays = 30 } = {}) {
  return alerts.filter((a) => a.daysUntil <= withinDays);
}

/**
 * リマインド・ダイジェストを人間可読なテキストレポートに整形する
 * （CLI表示・ログ用。formatEligibilityReport と同様の位置づけ）。
 *
 * @param {ReminderAlert[]} alerts
 * @returns {string}
 */
export function formatReminderDigest(alerts) {
  const lines = ["# 更新リマインド・ダイジェスト", ""];

  if (alerts.length === 0) {
    lines.push("対象のリマインドはありません。");
    return lines.join("\n");
  }

  const overdue = alerts.filter((a) => a.isOverdue);
  const dueSoon = alerts.filter((a) => !a.isOverdue && a.daysUntil <= 30);
  const upcoming = alerts.filter((a) => !a.isOverdue && a.daysUntil > 30);

  if (overdue.length > 0) {
    lines.push("## ⚠ 期限超過（至急確認してください）");
    for (const a of overdue) lines.push(formatLine(a));
    lines.push("");
  }
  if (dueSoon.length > 0) {
    lines.push("## 30日以内に期限が到来");
    for (const a of dueSoon) lines.push(formatLine(a));
    lines.push("");
  }
  if (upcoming.length > 0) {
    lines.push("## 今後の予定（31日以降）");
    for (const a of upcoming) lines.push(formatLine(a));
  }

  return lines.join("\n").trimEnd();
}

/** @param {ReminderAlert} alert */
function formatLine(alert) {
  const daysLabel = alert.isOverdue ? `${Math.abs(alert.daysUntil)}日超過` : `残り${alert.daysUntil}日`;
  return `- [${alert.clientName}] ${alert.label}: ${alert.dueDateIso}（${daysLabel}）`;
}
