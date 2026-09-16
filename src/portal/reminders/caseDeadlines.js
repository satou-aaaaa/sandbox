/**
 * 案件（`CaseRecord`）の納期から、コアの`ReminderAlert`と同じ形の
 * リマインド項目を生成する。
 *
 * 【設計判断（あえてregisterScheduleFnを使わない理由）】コアの
 * `registerScheduleFn`は「`LicenseEntry`を1件受け取り`ScheduleItem[]`を
 * 返す」という、許可という単位を前提にした契約になっている。案件を
 * 無理やり`LicenseEntry`として扱うと`licenseCategory`に不自然な値を
 * 持たせることになり、「コアは許可種別を知らない」というコア設計の
 * 一貫性が崩れる。そのため本モジュールはコアの型・レジストリには触れず、
 * `bucketizeAlerts`・`formatReminderDigest`という表示用の関数だけを
 * 再利用する（docs/DESIGN_uketsuke-portal.md 5章）。
 *
 * 許可のリマインド一覧（`buildReminderDigest`）とは別のコマンド・別の
 * 出力として扱い、両者を強制的に1つの一覧に統合はしない。
 */
import { daysUntil } from "../../core/reminders/dateUtils.js";

/**
 * 未完了（status !== "完了"）の案件から、コアと同形式のリマインド項目を生成する。
 * @param {import('../types.js').CaseRecord[]} cases
 * @param {import('../types.js').PartnerRecord[]} partners
 * @param {string} [todayIso] 基準日（YYYY-MM-DD）。省略時は本日
 * @returns {import('../../core/reminders/digest.js').ReminderAlert[]}
 */
export function buildCaseDeadlineAlerts(cases, partners, todayIso) {
  const partnerById = new Map(partners.map((p) => [p.partnerId, p]));
  return cases
    .filter((c) => c.status !== "完了")
    .map((c) => {
      const days = daysUntil(c.dueDateIso, todayIso);
      const partner = partnerById.get(c.partnerId);
      return {
        clientName: `${partner?.partnerName ?? "(元請不明)"} / ${c.caseName}`,
        type: "case-due",
        label: `納期（ステータス: ${c.status}）`,
        dueDateIso: c.dueDateIso,
        daysUntil: days,
        isOverdue: days < 0,
        contactEmail: partner?.contactEmail,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
