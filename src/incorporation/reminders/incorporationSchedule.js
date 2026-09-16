/**
 * 会社設立サポート案件の定款認証予約日・出資金払込期限から、コアと
 * 同形式のリマインド項目を生成する。
 *
 * 【設計判断（あえてregisterScheduleFnを使わない理由）】コアの
 * `registerScheduleFn`は「`LicenseEntry`を1件受け取り`ScheduleItem[]`を
 * 返す」という、許可という単位・反復的な期限計算を前提にした契約になって
 * いる。会社設立の期日（定款認証予約日・払込期限）は案件ごとに一度きりの
 * 単発の期日であり、無理に`LicenseEntry`として扱おうとするとコア設計の
 * 一貫性（「コアは許可種別を知らない」原則）が崩れる。そのため本モジュールも
 * `docs/DESIGN_uketsuke-portal.md`と同じく、コアの型・レジストリには触れず、
 * `bucketizeAlerts`・`formatReminderDigest`という表示用の関数だけを再利用
 * する（`docs/DESIGN_kaisha-secchi-support.md` 5章）。
 *
 * 許可のリマインド一覧（`buildReminderDigest`）・BtoB下請け案件の納期一覧
 * とは別のコマンド・別の出力として扱い、両者を強制的に1つの一覧に統合
 * しない。
 */
import { daysUntil } from "../../core/reminders/dateUtils.js";

/**
 * 未完了（status !== "完了"）の会社設立案件から、コアと同形式の
 * リマインド項目を生成する。定款認証予約日（株式会社のみ）・
 * 出資金払込期限の2種類を対象とする（要件定義書FR-I3.1・FR-I3.2）。
 *
 * @param {import('../types.js').IncorporationCaseRecord[]} cases
 * @param {string} [todayIso]
 * @returns {import('../../core/reminders/digest.js').ReminderAlert[]}
 */
export function buildIncorporationScheduleAlerts(cases, todayIso) {
  const alerts = [];
  for (const c of cases) {
    if (c.status === "完了") continue;

    // 定款認証予約日（株式会社のみ。合同会社はninshoYoteiIsoが常に
    // 未設定のため、このifに入らず自動的にリマインド対象から外れる。FR-I4.1）
    if (c.ninshoYoteiIso) {
      const days = daysUntil(c.ninshoYoteiIso, todayIso);
      alerts.push({
        clientName: `${c.clientName} / ${c.teikan.companyName}`,
        type: "teikan-ninsho",
        label: "定款認証の予約日",
        dueDateIso: c.ninshoYoteiIso,
        daysUntil: days,
        isOverdue: days < 0,
        contactEmail: c.contactEmail,
      });
    }

    // 出資金払込期限（払込完了記録が無い場合のみ。FR-I3.2・FR-I3.3）
    if (c.funsoKigenIso && !c.funsoKanryoIso) {
      const days = daysUntil(c.funsoKigenIso, todayIso);
      alerts.push({
        clientName: `${c.clientName} / ${c.teikan.companyName}`,
        type: "funso-kigen",
        label: "出資金払込の期限",
        dueDateIso: c.funsoKigenIso,
        daysUntil: days,
        isOverdue: days < 0,
        contactEmail: c.contactEmail,
      });
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
  // 【スコープ外の確認】設立登記そのものの期限計算はここに含めない
  // （要件定義書FR-I3.4・1.3節）。払込完了後の司法書士への引継ぎを
  // 促す注意喚起は、docx生成側の案内文言としてのみ表現し、
  // 期限計算付きのリマインド項目にはしない設計判断とした。
}
