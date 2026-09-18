/**
 * 在留期間満了リマインドの計算（可変期間の有効期限型。第四のリマインドパターン）。
 *
 * 建設業許可・産廃許可は「許可年月日」から満了日を計算していたのに対し、
 * 本モジュールは「満了日そのもの」を入力として受け取る（在留期間が
 * 3月/1年/3年/5年と可変で、許可日から一意に計算できないため）。この違いは
 * コアの`ScheduleFn`契約（`LicenseEntry`→`ScheduleItem[]`）の中に自然に
 * 収まり、コア側のインターフェース変更は不要だった
 * （docs/DESIGN_gijinkoku-core.md 4.3節参照）。
 *
 * 【法令確認済み・2026年9月】更新申請を期限までに行えば、「処分がされる時、
 * 又は在留期間満了日から2ヶ月が経過する時」のいずれか早い時までは引き続き
 * 在留できる特例期間があるが、無期限ではない
 * （出入国在留管理庁公式サイト「特例期間とは？」参照。
 * https://www.moj.go.jp/isa/applications/procedures/tokureikikan_00001.html）。
 */
import { addDaysIso } from "../../../core/reminders/dateUtils.js";

/**
 * @typedef {Object} GijinkokuLicenseDetail 技人国ビザのクライアント側追加情報
 *   （`LicenseEntry.gijinkokuDetail`の中身。CSVの列としては持たせない）
 * @property {string} [expiryDateIso] 在留カード記載の満了日（YYYY-MM-DD）
 * @property {"3月" | "1年" | "3年" | "5年"} [periodType] 在留期間の区分（表示用の参考情報。リマインド計算自体はexpiryDateIsoのみを使う）
 */

/**
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { gijinkokuDetail?: GijinkokuLicenseDetail }} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcZairyuKikanSchedule(license) {
  const expiryDateIso = license.gijinkokuDetail?.expiryDateIso;
  if (!expiryDateIso) return [];
  return [
    { type: "zairyu-early-notice", label: "在留期間更新の早期検討（満了90日前）", dueDateIso: addDaysIso(expiryDateIso, -90) },
    { type: "zairyu-prepare", label: "更新申請の推奨開始日（満了60日前）", dueDateIso: addDaysIso(expiryDateIso, -60) },
    {
      type: "zairyu-deadline",
      label: "更新申請の目安締切（満了30日前。特例期間は満了後2ヶ月までである点に注意）",
      dueDateIso: addDaysIso(expiryDateIso, -30),
    },
  ];
}
