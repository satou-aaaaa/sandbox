/**
 * 在留資格「特定技能」（1号）申請支援に使うデータ型定義（JSDoc）。
 * 在留資格変更許可申請・技能実習制度そのもの・特定技能2号は対象外
 * （docs/REQUIREMENTS_tokutei-ginou-core.md 4.6節スコープ外）。
 *
 * 【重要】本モジュールはgijinkoku-core（技人国ビザ）よりも制度が複雑で
 * ある（分野別技能試験・登録支援機関との関係・通算在留期間の上限管理）。
 * 外国人本人の旅券番号・技能実習時の詳細な処遇記録等、書類生成に不要な
 * 個人情報は含めない（NFR-T1・NFR-G1の踏襲）。
 */

/**
 * @typedef {Object} GinouShikenInput 技能水準の判定に使う入力
 * @property {string} fieldKey 対象の特定産業分野キー（fieldRegistryのキーと対応）
 * @property {boolean} hasPassedSkillTest 分野別の技能評価試験に合格しているか
 * @property {boolean} hasCompletedGinouJisshu2GoWell 技能実習2号を良好に修了しているか
 * @property {boolean} [isSameWorkCategoryAsGinouJisshu]
 *   技能実習2号修了により免除を主張する場合、修了した技能実習の作業区分と
 *   特定技能の業務区分が同一と考えられるか（自己申告。最終判断は人手確認）
 */

/**
 * @typedef {Object} NihongoNouryokuInput 日本語能力水準の判定に使う入力
 * @property {boolean} hasJlptN4OrAbove 日本語能力試験N4以上に合格しているか
 * @property {boolean} hasPassedJftBasic JFT-Basicに合格しているか
 * @property {boolean} isExemptByGinouJisshu2Go
 *   技能実習2号の良好な修了により日本語試験が免除される対象か
 *   （GinouShikenInput.hasCompletedGinouJisshu2GoWellと連動する入力だが、
 *   判定関数の独立性を保つため別フィールドとして持たせる）
 */

/**
 * @typedef {Object} ShozokuKikanKijunInput 特定技能所属機関（受入れ機関）自体の基準判定に使う入力
 *   【注意】これは「特定技能雇用契約及び一号特定技能外国人支援計画の
 *   基準等を定める省令」（平成三十一年法務省令第五号）第1条・第2条が
 *   定める基準（労働・社会保険・租税関係法令の遵守、直近1年以内の
 *   非自発的離職や失踪者発生の有無、各種欠格事由等）のうち、フェーズ1で
 *   判定対象とする代表的な項目に絞った暫定整理であり、確定仕様ではない
 *   （号立ての全項目化は9章の拡張ポイント）。
 * @property {string} companyName 特定技能所属機関（受入れ企業）名
 * @property {boolean} noLaborLawViolationWithin5Years 過去5年以内に労働関係法令違反による処分を受けていないか
 * @property {boolean} noImmigrationLawViolationWithin5Years 過去5年以内に入管法令違反による処分を受けていないか
 * @property {number} offeredSalaryAnnual 提示する年収（円）
 * @property {number} comparableJapaneseSalaryAnnual 比較対象となる、同種業務に従事する日本人の年収水準（円）
 */

/**
 * @typedef {Object} ShienTaiseiInput 1号特定技能外国人支援計画の実施体制判定に使う入力
 * @property {"自社実施" | "全部委託" | "一部委託"} shienMethod 支援計画の実施方法
 * @property {boolean} [hasShienSekininsha] 自社実施・一部委託の場合、支援責任者を選任しているか
 * @property {boolean} [hasShienTantousha] 自社実施・一部委託の場合、支援担当者を選任しているか
 * @property {boolean} [hasStaffWithSodanExperience]
 *   過去2年以内に中長期在留者の生活相談業務に従事した経験がある者を配置しているか
 *   （自社実施の必須要件の一つ）
 * @property {boolean} [canSupportInUnderstandableLanguage] 外国人が理解できる言語での支援体制があるか
 * @property {string} [registeredSupportOrgName] 委託先の登録支援機関名（全部委託・一部委託の場合）
 * @property {boolean[]} mandatorySupportItemsCovered
 *   義務的支援10項目それぞれが計画に含まれているかのフラグ配列（長さ10固定。
 *   支援省令第3条イ〜ヌの10項目とラベルを対応付ける）
 */

/**
 * @typedef {Object} TokuteiGinouApplicantProfile 申請の総合入力データ
 * @property {string} applicantName 外国人本人の氏名
 * @property {string} [nationality]
 * @property {string} jobDescription 職務内容の自由記述
 * @property {GinouShikenInput} ginouShiken
 * @property {NihongoNouryokuInput} nihongoNouryoku
 * @property {ShozokuKikanKijunInput} shozokuKikanKijun
 * @property {ShienTaiseiInput} shienTaisei
 */

export {};
