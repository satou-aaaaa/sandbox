/**
 * 飲食店営業許可（食品衛生法に基づく営業許可）の要件判定に使うデータ型
 * 定義（JSDoc）。
 *
 * 【重要】HACCPに沿った衛生管理は、e-Gov法令検索で確認した食品衛生法
 * 第55条（営業許可）の許可拒否事由に含まれておらず、同法第51条に基づく
 * 別個の継続的遵守義務である（2026年9月確認）。この区別を型レベルでも
 * 徹底するため、HACCP関連のフィールドは本ファイルに一切持たせない
 * （docs/DESIGN_inshokuten-eigyo-core.md 1章の設計原則）。
 */

/**
 * @typedef {Object} ShisetsuKijunInput 施設基準の判定に使う入力。
 *   食品衛生法施行条例上の具体的な数値基準は自治体により異なりうるため、
 *   以下は代表的な基準セット（要件定義書NFR-I2）を暫定的に整理したもの。
 * @property {number} sinkCount 洗浄・すすぎ用のシンクの数（2槽以上が目安）
 * @property {boolean} hasNonTouchHandwashing 手洗い設備が「洗浄後の手指の再汚染を防止できる構造」（レバー式・肘操作式・自動センサー式等）か。ひねる水栓のみの場合はfalse
 * @property {boolean} hasWashableWallFloorMaterial 床・壁・天井が耐水性・清掃しやすい材質か
 * @property {boolean} hasAdequateVentilation 適切な換気設備があるか
 * @property {number} [lightingLux] 調理場の照度（ルクス）。基準値は自治体により異なる（目安150ルクス以上）
 * @property {boolean} hasProperDrainage 適切な給排水設備・グリストラップがあるか
 * @property {boolean} usesTankOrWellWater 貯水槽水・井戸水を使用するか（trueの場合、水質検査が必要）
 * @property {boolean} [hasWaterQualityTestReport] 水質検査成績書を準備済みか（usesTankOrWellWaterがtrueの場合のみ確認）
 */

/**
 * @typedef {Object} SekininshaInput 食品衛生責任者の設置要件の判定に使う入力
 * @property {string} name 食品衛生責任者の氏名
 * @property {"調理師" | "製菓衛生師" | "栄養士" | "講習会受講修了" | "未定"} qualificationType 資格の種別
 * @property {boolean} isDesignatedPerStore 当該店舗専属で設置されているか（既存資格による免除の場合も、店舗ごとの設置は必須）
 */

/**
 * @typedef {Object} InshokutenApplicantProfile 申請の総合入力データ。
 *   HACCP関連のフィールドは意図的に持たせない（本ファイル冒頭の注記参照）。
 * @property {string} applicantName 申請者（営業者）氏名または法人名
 * @property {string} [businessName] 屋号（店舗名）
 * @property {string} storeAddress 営業所（店舗）所在地
 * @property {string} municipalityName 管轄保健所の自治体名
 * @property {string} [phoneNumber] 電話番号
 * @property {ShisetsuKijunInput} shisetsu
 * @property {SekininshaInput} sekininsha
 * @property {string} [plannedOpeningDateIso] 開業予定日（任意。案内文書の目安計算に使用）
 */

export {};
