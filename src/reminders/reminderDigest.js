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
 * @property {string} [contactEmail] 連絡先メールアドレス（任意。指定した場合のみ
 *   buildReminderMailtoUrl でメール下書きのURLを生成できる。本モジュールは
 *   このアドレスへメールを送信すること自体は行わない）
 */

/**
 * @typedef {Object} ReminderAlert 1件のリマインド項目
 * @property {string} clientName
 * @property {"renewal-early-notice" | "renewal-prepare" | "renewal-deadline" | "kessan-henko"} type
 * @property {string} label 人間可読なラベル
 * @property {string} dueDateIso 期限日（YYYY-MM-DD）
 * @property {number} daysUntil 基準日から期限日までの残り日数（負なら期限超過）
 * @property {boolean} isOverdue 期限を過ぎているか
 * @property {string} [contactEmail] クライアントの連絡先メールアドレス（登録があれば）
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
      makeAlert(
        record,
        "renewal-early-notice",
        "更新準備の早期検討（満了180日前）",
        schedule.earlyNoticeDate,
        todayIso
      )
    );
    alerts.push(
      makeAlert(record, "renewal-prepare", "更新準備開始の推奨日（満了60日前）", schedule.recommendedStartDate, todayIso)
    );
    alerts.push(
      makeAlert(record, "renewal-deadline", "更新申請の最終締切（満了30日前）", schedule.hardDeadline, todayIso)
    );
    if (record.fiscalYearEndIso) {
      const kessanDeadline = calcKessanHenkoDeadline(record.fiscalYearEndIso);
      alerts.push(makeAlert(record, "kessan-henko", "決算変更届の提出期限", kessanDeadline, todayIso));
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * @param {ClientLicenseRecord} record
 * @param {ReminderAlert["type"]} type
 * @param {string} label
 * @param {string} dueDateIso
 * @param {string} [todayIso]
 * @returns {ReminderAlert}
 */
function makeAlert(record, type, label, dueDateIso, todayIso) {
  const days = daysUntil(dueDateIso, todayIso);
  return {
    clientName: record.clientName,
    type,
    label,
    dueDateIso,
    daysUntil: days,
    isOverdue: days < 0,
    contactEmail: record.contactEmail,
  };
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
 * `GET /reminders`（Web画面）専用の残日数バケット区分。キーはそのまま
 * `?range=<key>` のクエリパラメータ値として使う。配列の順序は画面上の
 * フィルタリンクの表示順を兼ねる。
 *
 * 【注意】これはWeb画面の一覧フィルタリング用の区分であり、CLI向けの
 * `formatReminderDigest`（期限超過／30日以内／それ以降の3区分。見出し文言も
 * 固定）とは別物。既存のCLI出力・テストへの影響を避けるため、意図的に
 * 別関数として分離している（`docs/DESIGN.md` §5.14参照）。
 */
export const REMINDER_RANGES = [
  { key: "overdue", label: "期限超過" },
  { key: "within-1m", label: "1ヶ月以内" },
  { key: "1-3m", label: "1〜3ヶ月" },
  { key: "3-6m", label: "3〜6ヶ月" },
  { key: "6m-plus", label: "6ヶ月超" },
];

/**
 * リマインド一覧を、期限までの残り日数に応じた5区分（バケット）に分類する。
 * 区分の境界（`daysUntil` は残り日数。負の場合は期限超過＝`isOverdue: true`）:
 *
 * - `overdue`: `isOverdue === true`（期限を過ぎているもの。日数は問わない）
 * - `within-1m`: 期限超過ではなく、かつ `daysUntil <= 30`（0日＝本日期限を含む）
 * - `1-3m`: `30 < daysUntil <= 90`（ちょうど30日は上のwithin-1mに含まれる、
 *   ちょうど90日はこちらに含まれる）
 * - `3-6m`: `90 < daysUntil <= 180`（ちょうど180日はこちらに含まれる）
 * - `6m-plus`: `daysUntil > 180`
 *
 * 各境界値は「以下（<=）」側に含める＝右側の区分は厳密不等号（<）で始まる、
 * という統一ルールにしている（境界日の二重計上・抜け漏れを防ぐため）。
 *
 * @param {ReminderAlert[]} alerts
 * @returns {Record<string, ReminderAlert[]>} `REMINDER_RANGES` の各 `key` を
 *   プロパティ名とする、該当アラートの配列
 */
export function bucketizeAlerts(alerts) {
  /** @type {Record<string, ReminderAlert[]>} */
  const buckets = {};
  for (const { key } of REMINDER_RANGES) buckets[key] = [];

  for (const alert of alerts) {
    if (alert.isOverdue) {
      buckets["overdue"].push(alert);
    } else if (alert.daysUntil <= 30) {
      buckets["within-1m"].push(alert);
    } else if (alert.daysUntil <= 90) {
      buckets["1-3m"].push(alert);
    } else if (alert.daysUntil <= 180) {
      buckets["3-6m"].push(alert);
    } else {
      buckets["6m-plus"].push(alert);
    }
  }
  return buckets;
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

/**
 * リマインド1件について、連絡用メールの下書きを開くための mailto: URL を生成する。
 *
 * 【重要】これはメールクライアント（Outlook/Gmail等）で下書きを開くだけであり、
 * このツール自体がメールを送信することはない（NFR-4: 外部送信をしない設計を
 * 維持するため）。実際に送信するかどうかの最終判断・操作は必ず本人が行う。
 *
 * @param {ReminderAlert} alert
 * @returns {string | null} 連絡先メールアドレスが未登録の場合は null
 */
export function buildReminderMailtoUrl(alert) {
  if (!alert.contactEmail) return null;

  const subject = `【${alert.clientName}様】${alert.label}のご案内（下書き）`;
  const body = [
    `${alert.clientName} 様`,
    "",
    "建設業許可に関するご連絡です。",
    `${alert.label}: ${alert.dueDateIso}`,
    "",
    "※ このメールは kensetsu-kyoka-toolkit が生成した下書きです。",
    "　内容をご確認・修正のうえ、送信前に必ず内容をチェックしてください。",
  ].join("\n");

  return `mailto:${alert.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
