/**
 * 飲食店営業許可アドオンをコアへ登録するエントリポイント。
 * `src/licenses/kobutsu/index.js`等と同じ役割。
 *
 * CLIスクリプト（scripts/*.js）・将来のWebサーバ対応時は、リマインドを
 * 計算するより前にこの関数を呼ぶこと（呼び忘れるとリマインドが静かに
 * 生成されなくなる。docs/DESIGN_kobutsu-core.md 8章の既知の注意点と同じ）。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcInshokutenKoshinSchedule } from "./reminders/koshinSchedule.js";

export function registerInshokutenEigyoLicense() {
  registerScheduleFn("inshokuten-eigyo", calcInshokutenKoshinSchedule);
}
