/**
 * 農地転用許可アドオンをコアへ登録するエントリポイント。
 * construction/kobutsu/sanpai/minpaku/gijinkoku の各index.jsと同じ役割
 * （docs/DESIGN_nouchi-tenyo-core.md 5章参照）。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcNouchiTenyoSchedule } from "./reminders/conditionDeadlineSchedule.js";

export function registerNouchiTenyoLicense() {
  registerScheduleFn("nouchi-tenyo", calcNouchiTenyoSchedule);
}
