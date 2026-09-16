/**
 * 経営事項審査（経審）申請支援の要件判定に使うデータ型定義（JSDoc）。
 * 点数（評点・総合評定値）は計算しない。入力データの形式完備性・
 * 前提条件の確認・書類生成に必要な範囲の型のみを定義する
 * （docs/DESIGN_keiei-jiko-shinsa-core.md 1章参照）。
 */

/**
 * @typedef {Object} X1Input 完成工事高評点（X1）算定用の入力データ（点数は計算しない。形式チェックのみ）
 * @property {number[]} annualCompletedWorkAmounts 直前2期または3期の完成工事高（円）。要素数2または3
 * @property {"2年平均" | "3年平均"} averagingMethod
 */

/**
 * @typedef {Object} X2Input 経営規模評点（X2）算定用の入力データ
 * @property {number} latestNetAssets 直近期の自己資本額（貸借対照表の純資産合計。円）
 * @property {number} averageProfitBeforeInterest 利払前利益の平均額（円。2年平均が原則）
 */

/**
 * @typedef {Object} ZInput 技術力評点（Z）算定用の入力データ
 * @property {{ qualification: string, count: number }[]} technicalStaff 資格区分ごとの技術職員数
 * @property {number} averageDirectContractCompletedWorkAmount 元請完成工事高の平均額（円）
 */

/**
 * @typedef {Object} WInput 社会性等評点（W）算定用の入力データ（自己申告のフラグが中心）
 * @property {boolean} isSocialInsuranceEnrolled 社会保険（健康保険・厚生年金・雇用保険）にすべて加入しているか
 * @property {number} yearsInBusiness 営業継続年数
 * @property {boolean} hasDisasterAgreement 防災協定を締結しているか
 * @property {boolean} hasBusinessSuspensionWithin1Year 直近1年以内に指名停止・営業停止等の処分を受けたか（法令遵守状況）
 * @property {boolean} isIso9001Registered ISO9001（品質管理）の登録の有無
 * @property {boolean} isIso14001Registered ISO14001（環境管理）の登録の有無
 */

/**
 * @typedef {Object} KeieiJikoShinsaPrerequisiteInput 前提条件確認用の入力
 * @property {boolean} isKessanHenkoTodokeSubmitted 直近決算分の決算変更届が提出済みか
 * @property {string[]} targetGyoshu 経審を受ける業種区分（1件以上）
 */

/**
 * @typedef {Object} KeieiJikoShinsaApplicantProfile 申請準備の総合入力データ
 * @property {string} applicantName
 * @property {string} [representativeName]
 * @property {KeieiJikoShinsaPrerequisiteInput} prerequisite
 * @property {X1Input} x1
 * @property {X2Input} x2
 * @property {"未申請" | "申請中" | "結果受領済み"} yBunsekiStatus Y（経営状況分析）の申請状況
 * @property {ZInput} z
 * @property {WInput} w
 */

export {};
