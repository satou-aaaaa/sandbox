/**
 * 許可種別ごとのリマインド・スケジュール計算関数を登録・取得する仕組み。
 * `src/licenses/construction/eligibility/prefectureRules.js` の都道府県ルール
 * 登録と同じレジストリパターン（docs/DESIGN_kobutsu-core.md 5.2節参照）。
 *
 * 各許可種別は、自身の LicenseEntry から「発生するリマインド項目の配列」を
 * 計算する関数を1つ登録する。建設業許可は「満了日ベース」、古物商許可は
 * 「変更トリガー型（変更が記録されている場合のみ発生）」というように、
 * 中身のロジックは許可種別ごとに全く異なってよい。コア側はその違いを
 * 一切意識しない。
 */

/**
 * @typedef {Object} ScheduleItem 1件分のリマインド予定
 * @property {string} type リマインド種別キー（許可種別ごとに自由に定義してよい。例: "renewal-deadline"）
 * @property {string} label 人間可読なラベル
 * @property {string} dueDateIso 期限日（YYYY-MM-DD）
 */

/**
 * @typedef {(license: import('./digest.js').LicenseEntry) => ScheduleItem[]} ScheduleFn
 *   1件の許可情報から、発生するリマインド予定の配列を返す関数。
 *   リマインドが発生しない場合は空配列を返してよい（古物商許可で
 *   変更記録が無い場合など）。
 */

/** @type {Map<string, ScheduleFn>} */
const registry = new Map();

/**
 * 許可種別ごとのスケジュール計算関数を登録する。
 * @param {string} licenseCategory 例: "construction", "kobutsu"
 * @param {ScheduleFn} scheduleFn
 */
export function registerScheduleFn(licenseCategory, scheduleFn) {
  registry.set(licenseCategory, scheduleFn);
}

/**
 * 指定した許可種別に登録済みのスケジュール計算関数を取得する。
 * 未登録の場合は undefined を返す（＝その許可種別のリマインドは生成しない）。
 * @param {string} licenseCategory
 * @returns {ScheduleFn | undefined}
 */
export function getScheduleFn(licenseCategory) {
  return registry.get(licenseCategory);
}

/** テスト用の後片付け。本番コードから呼ばない。 */
export function clearScheduleFns() {
  registry.clear();
}
