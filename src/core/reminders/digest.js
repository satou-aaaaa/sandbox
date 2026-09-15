/**
 * M4（通知連携）の土台となる「リマインド・ダイジェスト」計算（許可種別非依存）。
 *
 * 【スコープ】本モジュールが行うのは、複数クライアントの許可情報から
 * 「今どのリマインドが必要か」を集計・整形することまで。実際のメール等の
 * 自動送信は行わない（通知チャネルの選定は発注者側の意思決定が必要であり、
 * 外部サービス連携が前提になるためNFR-2・NFR-4との整合を要する。
 * 詳細は docs/DESIGN.md 9章を参照）。
 *
 * 更新関連リマインドの具体的な計算方法は許可種別ごとに大きく異なるため、
 * `scheduleTypes.js`（レジストリパターン）経由で許可種別ごとの計算関数
 * （`getScheduleFn`）を呼び出す方式にしている（docs/DESIGN_kobutsu-core.md
 * 5.3節）。本モジュール自身は「建設業」「古物商」等の固有の許可種別名・
 * 法令名を一切知らない。
 */
import { getScheduleFn } from "./scheduleTypes.js";
import { daysUntil } from "./dateUtils.js";
import { calcKessanHenkoDeadline } from "../../licenses/construction/reminders/renewalSchedule.js";

/**
 * @typedef {Object} LicenseEntry 許可1件分の情報（ADR-0008。許可種別非依存の共通部分）
 * @property {string} licenseId クライアント内で一意なラベル（例: "般-建築工事業"）
 * @property {string} [licenseCategory] 許可種別を示すキー（例: "construction", "kobutsu"）。
 *   省略時は "construction" とみなす（後方互換。docs/DESIGN_kobutsu-core.md 4.2節）。
 *   コアはこのキーの中身を解釈しない、単なる `scheduleTypes.js` のレジストリキー
 * @property {"一般" | "特定"} [licenseType] 建設業許可のみで使用するフィールド
 * @property {string} [grantDateIso] 建設業許可のみで使用する許可年月日（YYYY-MM-DD）。古物商許可では未使用
 *
 * 許可種別固有の追加情報（例: 古物商許可の変更履歴等）は、この型に
 * フィールドを追加する形ではなく、各 `src/licenses/<種別>/` 側で
 * 必要なプロパティを読み取る形にする（コアが特定の許可種別名を
 * 知らないようにするため。1章の設計原則参照）。
 */

/**
 * @typedef {Object} ClientRecord クライアント（会社）1件分の情報（ADR-0008）
 * @property {string} clientName クライアント名（会社名 or 個人名）
 * @property {string} [fiscalYearEndIso] 直近の事業年度終了日（YYYY-MM-DD、任意。
 *   指定した場合のみ決算変更届のリマインドを計算する。決算日は会社単位の
 *   属性であり、保有する許可の数に関わらず1つだけ持つ（許可ごとに
 *   重複させない。重複させると決算変更届のリマインドが許可の数だけ
 *   重複して生成されてしまう）
 * @property {string} [contactEmail] 連絡先メールアドレス（任意、会社単位。
 *   指定した場合のみ buildReminderMailtoUrl でメール下書きのURLを生成できる。
 *   本モジュールはこのアドレスへメールを送信すること自体は行わない）
 * @property {LicenseEntry[]} licenses 保有する許可の一覧（1件以上）
 */

/**
 * @typedef {Object} ReminderAlert 1件のリマインド項目
 * @property {string} clientName
 * @property {string} type リマインド種別キー（許可種別ごとに`scheduleTypes.js`経由で自由に定義される。
 *   建設業許可: "renewal-early-notice" | "renewal-prepare" | "renewal-deadline" | "kessan-henko"。
 *   古物商許可等、他の許可種別は別のキーを使う）
 * @property {string} label 人間可読なラベル
 * @property {string} dueDateIso 期限日（YYYY-MM-DD）
 * @property {number} daysUntil 基準日から期限日までの残り日数（負なら期限超過）
 * @property {boolean} isOverdue 期限を過ぎているか
 * @property {string} [contactEmail] クライアントの連絡先メールアドレス（登録があれば）
 * @property {string} [licenseId] どの許可に対するリマインドかを示すラベル
 *   （更新関連の3種のみに付与する。決算変更届はクライアント単位のため
 *   付与しない。1クライアントが複数許可を持つ場合に一覧上で区別するための
 *   もの。ADR-0008・FR-5.4参照）
 */

/**
 * クライアント一覧から、リマインド項目の一覧を計算する。
 * 「クライアント→保有する各許可」の二重ループで、更新関連のリマインド
 * （早期検討・準備開始・最終締切）を許可ごとに個別生成する（FR-5.4）。
 * 決算変更届のリマインドは、保有する許可の数に関わらずクライアントごとに
 * 1件のみ生成する（FR-5.3。重複防止のため二重ループの外側で1回だけ計算する）。
 * 期限が近い順（daysUntil昇順。期限超過が先頭）にソートして返す。
 *
 * @param {ClientRecord[]} records
 * @param {string} [todayIso] 基準日（YYYY-MM-DD）。省略時は本日
 * @returns {ReminderAlert[]}
 */
export function buildReminderDigest(records, todayIso) {
  const alerts = [];
  for (const record of records) {
    for (const license of record.licenses) {
      const category = license.licenseCategory ?? "construction";
      const scheduleFn = getScheduleFn(category);
      if (!scheduleFn) continue; // 未登録の許可種別はリマインド対象外
      for (const item of scheduleFn(license)) {
        alerts.push(makeAlert(record, item.type, item.label, item.dueDateIso, todayIso, license));
      }
    }
    // 決算変更届は会社単位のリマインドのため、許可ごとのループの外で
    // クライアントにつき1回だけ生成する（FR-5.3。重複防止）。
    // 【注意】決算変更届は建設業許可固有の概念だが、現行実装はrecord単位
    // （許可ループの外）でしか発生しない特殊な形になっている。既存の出力を
    // 変えないことを優先し、この分岐をそのまま残す（3つ目以降の許可種別を
    // 追加する際、「クライアント単位の追加リマインド」という概念自体を
    // コア側に一般化するかは今後の検討課題。docs/DESIGN_kobutsu-core.md
    // 5.3節・9章参照）。
    if (record.fiscalYearEndIso) {
      const kessanDeadline = calcKessanHenkoDeadline(record.fiscalYearEndIso);
      alerts.push(makeAlert(record, "kessan-henko", "決算変更届の提出期限", kessanDeadline, todayIso));
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * @param {ClientRecord} record
 * @param {ReminderAlert["type"]} type
 * @param {string} label
 * @param {string} dueDateIso
 * @param {string} [todayIso]
 * @param {LicenseEntry} [license] 指定した場合、生成するアラートに licenseId を付与する
 * @returns {ReminderAlert}
 */
function makeAlert(record, type, label, dueDateIso, todayIso, license) {
  const days = daysUntil(dueDateIso, todayIso);
  /** @type {ReminderAlert} */
  const alert = {
    clientName: record.clientName,
    type,
    label,
    dueDateIso,
    daysUntil: days,
    isOverdue: days < 0,
    contactEmail: record.contactEmail,
  };
  if (license) alert.licenseId = license.licenseId;
  return alert;
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
  // 1クライアントが複数許可を持つ場合、どの許可分のリマインドかを一覧上で
  // 判別できるようにする（FR-5.4）。決算変更届等 licenseId を持たないアラートは
  // 従来どおりの表示のまま。
  const licenseLabel = alert.licenseId ? `（許可: ${alert.licenseId}）` : "";
  return `- [${alert.clientName}]${licenseLabel} ${alert.label}: ${alert.dueDateIso}（${daysLabel}）`;
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
    // 複数許可を保有するクライアントの場合、どの許可に対する連絡かを
    // 本文にも明記する（FR-5.4）。
    alert.licenseId ? `対象の許可: ${alert.licenseId}` : null,
    `${alert.label}: ${alert.dueDateIso}`,
    "",
    "※ このメールは kensetsu-kyoka-toolkit が生成した下書きです。",
    "　内容をご確認・修正のうえ、送信前に必ず内容をチェックしてください。",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `mailto:${alert.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
