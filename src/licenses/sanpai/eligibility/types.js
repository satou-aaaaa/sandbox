/**
 * 産業廃棄物収集運搬業許可の要件判定に使うデータ型定義（JSDoc）。
 * 特別管理産業廃棄物・積替え保管を伴う許可は本フェーズ対象外
 * （docs/REQUIREMENTS_sanpai-core.md 4.6節スコープ外）。
 */

/**
 * @typedef {Object} SanpaiKekkakuInput 欠格事由（廃棄物処理法第14条第5項第2号。
 *   同号は第7条第5項第4号イ〜チを包含する形で規定。e-Gov法令検索で原文
 *   確認済み・2026年9月。docs/DESIGN_sanpai-core.md 3章参照）
 * @property {boolean} hasMentalImpairmentAffectingDuties 心身の故障により業務を適切に行うことができない者か（7条5項4号イ）
 * @property {boolean} isUndischargedBankrupt 破産手続開始の決定を受けて復権を得ないか（7条5項4号ロ）
 * @property {boolean} hasCriminalRecordWithin5Years 拘禁刑以上の刑に処せられ執行終了等から5年を経過しないか（7条5項4号ハ）
 * @property {boolean} hasWasteLawViolationWithin5Years この法律・浄化槽法違反もしくはこれらに基づく処分・暴力団対策法違反、又は特定の暴力犯罪（刑法204条等）により罰金刑に処せられ5年を経過しないか（7条5項4号ニ）
 * @property {boolean} hadPermitRevokedWithin5Years 許可取消しから5年を経過しないか（法人の場合、取消し処分の通知前60日以内に役員だった者を含む。7条5項4号ホ）
 * @property {boolean} hasBusinessClosureDuringRevocationProcessWithin5Years 許可取消し処分の手続中に事業廃止の届出をして5年を経過しないか（取消し逃れ防止規定。役員・使用人であった者を含む。7条5項4号ヘ・ト）
 * @property {boolean} hasDishonestConductRisk その業務に関し不正又は不誠実な行為をするおそれがあると認めるに足りる相当の理由があるか（7条5項4号チ）
 * @property {boolean} isBoryokudanRelated 暴力団員、又は暴力団員でなくなった日から5年を経過しない者に該当するか（14条5項2号ロ。この項目のみ根拠条文が7条5項4号ではなく14条5項2号自体である点に注意）
 */

/**
 * @typedef {Object} KoushuInput 講習修了の判定に使う入力
 * @property {string} completionDateIso 講習修了証の発行年月日（YYYY-MM-DD）
 * @property {string} plannedApplicationDateIso 申請予定日（YYYY-MM-DD）。completionDateIso から5年以内であることを判定する基準日
 */

/**
 * @typedef {Object} KeiriKisoInput 経理的基礎の判定に使う入力（直近期のみの簡易判定。FR-S1.3）
 * @property {number} latestNetAssets 直近期の自己資本額（円）
 * @property {number} [latestOperatingIncome] 直近期の営業損益（円。参考値）
 */

/**
 * @typedef {Object} VehicleInput 運搬車両1台分の情報（事業計画書用）
 * @property {string} vehicleType 車両の種類（例: "4tダンプ"）
 * @property {string} plateNumber 登録番号
 * @property {boolean} hasSpillPreventionMeasures 飛散・流出防止措置の有無
 */

/**
 * @typedef {Object} SanpaiApplicantProfile 申請者の総合入力データ
 * @property {string} applicantName 申請者氏名（法人の場合は法人名）
 * @property {string} [representativeName] 代表者氏名（法人の場合）
 * @property {string} [address] 住所
 * @property {string} [prefecture] 活動予定の都道府県
 * @property {SanpaiKekkakuInput} kekkaku
 * @property {KoushuInput} koushu
 * @property {KeiriKisoInput} keiriKiso
 * @property {boolean} hasOdorSpillPreventionMeasures 運搬容器の飛散・流出・悪臭防止措置（自己申告）
 * @property {VehicleInput[]} vehicles 運搬車両の一覧（1台以上）
 * @property {string[]} [wasteTypes] 取り扱う産業廃棄物の種類（例: ["がれき類", "木くず"]）
 */

export {};
