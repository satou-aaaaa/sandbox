/**
 * 特定技能モジュールをコアへ登録するエントリポイント。
 * `src/licenses/gijinkoku/index.js`と同じ役割。加えて、分野レジストリの
 * 初期データ投入もここで行う（呼び出し忘れを防ぐため、分野レジストリの
 * seedもindex.js側で一元管理する）。
 *
 * CLIスクリプト（scripts/*.js）・将来のWebサーバ対応時は、リマインドを
 * 計算するより前にこの関数を呼ぶこと。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcTokuteiGinouSchedule } from "./reminders/tokuteiGinouSchedule.js";
import { seedFieldRegistry } from "./eligibility/fieldRegistry.seed.js";

export function registerTokuteiGinouModule() {
  seedFieldRegistry();
  registerScheduleFn("tokutei-ginou", calcTokuteiGinouSchedule);
}
