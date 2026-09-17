/**
 * 特定産業分野ごとの技能評価試験名・分野固有要件フラグのレジストリ。
 *
 * `docs/DESIGN_kobutsu-core.md`の`prefectureRules.js`（都道府県ごとの
 * ルール登録・取得）と同じ設計思想のモジュール内レジストリであり、
 * コアの`scheduleTypes.js`（許可種別をまたぐレジストリ）とは別レイヤーで
 * ある点に注意する（本モジュール内で完結する、分野という一段細かい
 * 粒度のレジストリ）。
 *
 * 初期データは`fieldRegistry.seed.js`に持たせ、分野の追加・改定時は
 * そちらのみを編集すればよい構造とする（本体のロジックは変更不要）。
 */

/**
 * @typedef {Object} FieldRegistryEntry 特定産業分野1件分の登録情報
 * @property {string} fieldKey 分野キー（例: "kaigo", "kensetsu", "gaishokugyo"）
 * @property {string} fieldLabel 分野の表示名（例: "介護", "建設", "外食業"）
 * @property {string} skillTestName 標準的な技能評価試験名（分野により複数試験がある場合は代表例のみ）
 * @property {boolean} requiresSectorSpecificJapaneseTest
 *   分野固有の日本語試験が別途必要か（例: 介護分野の介護日本語評価試験）。
 *   trueの場合でも試験内容自体の判定ロジックは実装しない（フェーズ1スコープ外）
 * @property {boolean} [supportsSpecifiedSkilled2] 特定技能2号への移行対象
 *   分野か（2026年9月追加。出入国管理及び難民認定法別表第一の二の表の
 *   特定技能の項の下欄に規定する産業上の分野等を定める省令〈令和8年4月1日
 *   施行版〉をe-Gov法令検索で確認し、2号の技能水準〈熟練した技能〉の対象が
 *   第2号・第4号〜第9号・第13号〜第16号の11分野に限定されていることを
 *   確認済み。介護分野は在留資格「介護」への移行が想定されており対象外、
 *   その他の対象外分野〈リネンサプライ・自動車運送業・鉄道・物流倉庫・
 *   林業・木材産業・資源循環〉は比較的新しい分野で2号の制度自体が
 *   未整備）。`tokuteiGinouSchedule.js`の通算5年上限警告の案内文言の
 *   出し分けに使う
 * @property {string} [supplementaryNote] 分野固有の留意事項の自由記述（例: 受入れ人数上限の有無等）
 */

/** @type {Map<string, FieldRegistryEntry>} */
const registry = new Map();

/** @param {FieldRegistryEntry} entry */
export function registerField(entry) {
  registry.set(entry.fieldKey, entry);
}

/** @param {string} fieldKey @returns {FieldRegistryEntry | undefined} */
export function getField(fieldKey) {
  return registry.get(fieldKey);
}

/** @returns {FieldRegistryEntry[]} 登録済み全分野（表示用） */
export function listFields() {
  return [...registry.values()];
}

/** テスト用の後片付け。本番コードから呼ばない。 */
export function clearFields() {
  registry.clear();
}
