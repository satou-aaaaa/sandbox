/**
 * 経営事項審査（経審）申請支援アドオンをコアへ登録するエントリポイント。
 * `src/licenses/kobutsu/index.js`等と同じ役割
 * （docs/DESIGN_keiei-jiko-shinsa-core.md 5章参照）。
 *
 * 本モジュールは建設業許可の保有を前提とするため、実務上は
 * `registerConstructionLicense()`と併用されることを想定する。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcKeieiJikoShinsaSchedule } from "./reminders/annualCycleSchedule.js";

export function registerKeieiJikoShinsaLicense() {
  registerScheduleFn("keiei-jiko-shinsa", calcKeieiJikoShinsaSchedule);
}
