/**
 * 住宅宿泊事業（民泊）届出アドオンをコアへ登録するエントリポイント。
 * `src/licenses/kobutsu/index.js`・`src/licenses/sanpai/index.js` と同じ役割
 * （docs/DESIGN_minpaku-core.md 4.4節参照）。
 *
 * CLIスクリプト（scripts/*.js）・将来のWebサーバ対応時は、リマインドを
 * 計算するより前にこの関数を呼ぶこと。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcMinpakuSchedule } from "./reminders/periodicReportSchedule.js";

export function registerMinpakuLicense() {
  registerScheduleFn("minpaku", calcMinpakuSchedule);
}
