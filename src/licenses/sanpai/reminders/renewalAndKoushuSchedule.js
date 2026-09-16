/**
 * 産廃許可の「更新」「講習修了証の期限」、2種類のリマインドを計算する。
 *
 * 【法令確認による設計変更】廃棄物処理法施行令第6条の9により、有効期間は
 * 一律5年ではなく「新規許可: 5年」「更新時、優良認定基準に適合: 7年」
 * 「適合しない場合: 5年」の3区分（e-Gov法令検索で原文確認済み・2026年9月）。
 * 月単位丸め計算ロジック自体は `src/core/reminders/expirySchedule.js`
 * （建設業許可・産廃許可の両方が利用する共通実装）を呼び出し、有効期間
 * （5または7）を引数として渡す（docs/DESIGN_sanpai-core.md 4.3節参照）。
 * 優良認定基準そのものの判定（環境省令の実質審査）はスコープ外のため、
 * `validityYears` は利用者が別途確認して入力する前提の参考値とする。
 */
import { calcExpirySchedule } from "../../../core/reminders/expirySchedule.js";

const DEFAULT_VALIDITY_YEARS = 5;

/**
 * @typedef {Object} SanpaiLicenseDetail 産廃許可のクライアント側追加情報
 *   （`LicenseEntry.sanpaiDetail` の中身。docs/DESIGN_kobutsu-core.md 4.4節の
 *   `kobutsuDetail` と同じパターンで、CSVの列としては持たせない）
 * @property {5 | 7} [validityYears] 有効期間（年）。未設定時は5年（優良認定なし）として扱う
 * @property {string} [koushuCompletionDateIso] 直近の講習修了証発行日（YYYY-MM-DD）
 */

/** @param {string} iso @param {number} years */
function addYearsIso(iso, years) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * @param {import('../../../core/reminders/digest.js').LicenseEntry & { sanpaiDetail?: SanpaiLicenseDetail }} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcSanpaiSchedule(license) {
  const items = [];
  if (license.grantDateIso) {
    const validityYears = license.sanpaiDetail?.validityYears ?? DEFAULT_VALIDITY_YEARS;
    const schedule = calcExpirySchedule(license.grantDateIso, validityYears);
    items.push({
      type: "sanpai-renewal-prepare",
      label: "産廃許可 更新準備開始（満了60日前）",
      dueDateIso: schedule.recommendedStartDate,
    });
    items.push({
      type: "sanpai-renewal-deadline",
      label: "産廃許可 更新申請の最終締切（満了30日前）",
      dueDateIso: schedule.hardDeadline,
    });
  }
  const koushuDate = license.sanpaiDetail?.koushuCompletionDateIso;
  if (koushuDate) {
    items.push({
      type: "sanpai-koushu-expiry",
      label: "講習修了証の有効期限（再受講の要否確認）",
      dueDateIso: addYearsIso(koushuDate, 5),
    });
  }
  return items;
}
