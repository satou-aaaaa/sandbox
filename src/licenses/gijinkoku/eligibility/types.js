/**
 * 在留資格「技術・人文知識・国際業務」の要件判定に使うデータ型定義
 * （JSDoc）。他の在留資格は対象外（docs/REQUIREMENTS_gijinkoku-core.md
 * 4.5節スコープ外）。
 *
 * 【重要】本モジュールは他の許可種別モジュールより専門性・リスクが高い
 * 分野を扱う。外国人本人の旅券番号等の識別情報は、書類生成に使わない
 * 情報として型に含めない（NFR-G1）。
 *
 * 【2026年9月・e-Gov法令検索で確認済み】学歴・実務経験要件（`gakureki`）・
 * 報酬要件（`hoshu`）・専攻/職務関連性（`kanrensei`）の判定基準は、
 * 新規招へい（認定証明書交付申請。入管法7条の2）・在留資格変更許可申請
 * （入管法20条。既に日本国内にいる外国人が現に有する在留資格から変更する
 * 場合）のいずれでも同一である（在留資格自体の該当性は申請の経路に
 * よらないため）。差異は申請書類・手続きの違いのみのため、
 * `documents/henkoShinseisho.js`（在留資格変更許可申請書）が既存の判定
 * ロジックをそのまま再利用する形で対応する（`documents/ninteiShinseisho.js`
 * 〈認定証明書交付申請書〉と対になる書類）。
 */

/**
 * @typedef {Object} GakurekiInput 学歴・実務経験要件の判定に使う入力。
 *   入管法基準省令（法別表第一の二の表・技術・人文知識・国際業務の項。
 *   e-Gov法令検索で原文確認済み・2026年9月）の項目一（自然科学・人文科学
 *   分野の技術・知識を要する業務）・項目二（外国の文化に基盤を有する
 *   思考・感受性を要する業務＝「国際業務」区分）で要件構造が異なる
 * @property {"大学卒業以上" | "専修学校専門課程修了" | "それ以外"} educationLevel
 * @property {number} [yearsOfRelevantExperience] 学歴要件・大学卒業免除のいずれも満たさない場合の、関連実務経験年数
 * @property {boolean} isInternationalServiceCategory 項目二（国際業務区分。通訳・翻訳・語学指導・広報・宣伝・海外取引業務・デザイン等）に該当するか。falseの場合は項目一として判定する
 * @property {boolean} [isTranslationInterpretationOrLanguageInstruction] 項目二のうち、特に通訳・翻訳・語学の指導の業務に従事するか（大学卒業者はこの業務に限り実務経験年数の要件が免除される）
 */

/**
 * @typedef {Object} HoshuInput 報酬要件の判定に使う入力
 * @property {number} offeredSalaryAnnual 提示する年収（円）
 * @property {number} comparableJapaneseSalaryAnnual 比較対象となる、同種業務に従事する日本人の年収水準（円）
 */

/**
 * @typedef {Object} KanranseiInput 専攻・職務関連性の判定材料（機械判定はしない。FR-G1.3）
 * @property {string} majorOrExperienceField 専攻分野、または代替実務経験の分野の自由記述
 * @property {string} jobDescription 従事する職務内容の自由記述
 */

/**
 * @typedef {Object} GijinkokuApplicantProfile 申請の総合入力データ
 * @property {string} applicantName 外国人本人の氏名
 * @property {string} [nationality]
 * @property {string} companyName 所属機関（受入企業）名
 * @property {1 | 2 | 3 | 4} [companyCategory] 所属機関カテゴリー（法令ではなく行政上の運用要領に基づくため自動判定はせず、確定している場合のみ利用者が入力する）
 * @property {GakurekiInput} gakureki
 * @property {KanranseiInput} kanrensei
 * @property {HoshuInput} hoshu
 * @property {string} [currentStatusOfResidence] 在留資格変更許可申請
 *   （入管法20条）の場合のみ使用。申請人が現に有する在留資格（例:
 *   "留学"「家族滞在」）。未入力（undefined）の場合は新規招へい
 *   （認定証明書交付申請）を前提とする
 * @property {string} [currentZairyuKikanMatsuIso] 在留資格変更許可申請の
 *   場合のみ使用。現に有する在留資格の在留期限（YYYY-MM-DD）。申請時に
 *   残存する在留期間の目安として申請書に記載する
 */

export {};
