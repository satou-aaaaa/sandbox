/**
 * 在留資格「技術・人文知識・国際業務」申請支援アドオンをコアへ登録する
 * エントリポイント。`src/licenses/kobutsu/index.js`等と同じ役割
 * （docs/DESIGN_gijinkoku-core.md 4.4節参照）。
 *
 * CLIスクリプト（scripts/*.js）・将来のWebサーバ対応時は、リマインドを
 * 計算するより前にこの関数を呼ぶこと。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcZairyuKikanSchedule } from "./reminders/zairyuKikanSchedule.js";

export function registerGijinkokuModule() {
  registerScheduleFn("gijinkoku", calcZairyuKikanSchedule);
}
