/**
 * 建設業許可アドオンをコアへ登録するエントリポイント。
 *
 * CLIスクリプト（scripts/*.js）・Webサーバ（src/web/server.js）の起動時に、
 * リマインドを計算するより前にこの関数を呼ぶこと（呼び忘れると建設業許可の
 * リマインドが静かに生成されなくなる。エラーにはならないので注意）。
 * docs/DESIGN_kobutsu-core.md 5.6節参照。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcRenewalSchedule } from "./reminders/renewalSchedule.js";

export function registerConstructionLicense() {
  registerScheduleFn("construction", (license) => {
    if (!license.grantDateIso) return [];
    const schedule = calcRenewalSchedule(license.grantDateIso);
    return [
      { type: "renewal-early-notice", label: "更新準備の早期検討（満了180日前）", dueDateIso: schedule.earlyNoticeDate },
      { type: "renewal-prepare", label: "更新準備開始の推奨日（満了60日前）", dueDateIso: schedule.recommendedStartDate },
      { type: "renewal-deadline", label: "更新申請の最終締切（満了30日前）", dueDateIso: schedule.hardDeadline },
    ];
  });
}
