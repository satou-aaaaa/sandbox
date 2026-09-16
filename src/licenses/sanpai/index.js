/**
 * 産業廃棄物収集運搬業許可アドオンをコアへ登録するエントリポイント。
 * `src/licenses/kobutsu/index.js` と同じ役割（docs/DESIGN_kobutsu-core.md
 * 5.14節・docs/DESIGN_sanpai-core.md 4.4節参照）。
 *
 * CLIスクリプト（scripts/*.js）・将来のWebサーバ対応時は、リマインドを
 * 計算するより前にこの関数を呼ぶこと。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcSanpaiSchedule } from "./reminders/renewalAndKoushuSchedule.js";

export function registerSanpaiLicense() {
  registerScheduleFn("sanpai", calcSanpaiSchedule);
}
