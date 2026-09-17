/**
 * 古物商許可アドオンをコアへ登録するエントリポイント。
 * `src/licenses/construction/index.js` と同じ役割（docs/DESIGN_kobutsu-core.md
 * 5.14節参照）。
 *
 * CLIスクリプト（scripts/*.js）・将来のWebサーバ対応時は、リマインドを
 * 計算するより前にこの関数を呼ぶこと。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import {
  calcShokanShinseiDeadline,
  calcEigyoshoHenkoJizenTodokedeDeadline,
  calcHenoukiDeadline,
} from "./reminders/changeSchedule.js";

/**
 * @param {import('../../core/reminders/digest.js').LicenseEntry & { kobutsuDetail?: import('./reminders/changeSchedule.js').KobutsuLicenseDetail }} license
 * @returns {import('../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
function kobutsuScheduleFn(license) {
  const items = [];
  const detail = license.kobutsuDetail;
  if (detail?.lastRecordedChangeDateIso) {
    items.push({
      type: "shokan-shinsei",
      label: "書換申請の期限",
      dueDateIso: calcShokanShinseiDeadline(detail.lastRecordedChangeDateIso),
    });
  }
  if (detail?.plannedEigyoshoChangeDateIso) {
    items.push({
      type: "eigyosho-henko-jizen-todokede",
      label: "営業所・古物市場の名称/所在地変更の事前届出期限（変更予定日の3日前）",
      dueDateIso: calcEigyoshoHenkoJizenTodokedeDeadline(detail.plannedEigyoshoChangeDateIso),
    });
  }
  if (detail?.closureDateIso) {
    items.push({
      type: "henou",
      label: "許可証の返納期限",
      dueDateIso: calcHenoukiDeadline(detail.closureDateIso),
    });
  }
  return items; // 変更・廃業の記録が無ければ空配列（＝リマインドなし）
}

export function registerKobutsuLicense() {
  registerScheduleFn("kobutsu", kobutsuScheduleFn);
}
