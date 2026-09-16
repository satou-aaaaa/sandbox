/**
 * 住宅宿泊事業（民泊）届出の要件判定に使うデータ型定義（JSDoc）。
 * 届出制のため、建設業許可・古物商許可・産廃許可のような裁量的な合否判定は
 * 基本的に不要で、欠格事由の確認と必要書類の充足チェックが中心になる
 * （docs/REQUIREMENTS_minpaku-core.md 1.1節）。
 */

/**
 * @typedef {Object} MinpakuKekkakuInput 欠格事由（住宅宿泊事業法第4条。
 *   e-Gov法令検索で原文確認済み・2026年9月。第5号（暴力団関係）のみ
 *   5年、他4号は3年である点に注意。docs/DESIGN_minpaku-core.md 3章参照）
 * @property {boolean} hasMentalOrPhysicalImpairment 心身の故障により住宅宿泊事業を的確に遂行することができない者か（第1号。国土交通省令・厚生労働省令で定めるもの）
 * @property {boolean} isUndischargedBankrupt 破産手続開始の決定を受けて復権を得ないか（第2号）
 * @property {boolean} hadBusinessSuspensionOrderWithin3Years 住宅宿泊事業の廃止命令（第16条第2項）を受け3年を経過しないか（第3号。法人の場合、命令前30日以内の役員だった者を含む）
 * @property {boolean} hasCriminalRecordWithin3Years 拘禁刑以上の刑、又は本法・旅館業法違反の罰金刑に処せられ、その執行を終わり若しくは執行を受けることがなくなった日から3年を経過しないか（第4号）
 * @property {boolean} isBoryokudanRelated 暴力団員、又は暴力団員でなくなった日から5年を経過しない者に該当するか（第5号。8号中、唯一5年の欠格事由）
 */

/**
 * @typedef {Object} RequiredDocumentItem 必要書類チェックリストの1項目
 * @property {string} key 書類キー（例: "touki-jikou-shomeisho"）
 * @property {string} label 書類名（例: "登記事項証明書"）
 * @property {boolean} obtained 取得済みか
 * @property {boolean} [isForeignLanguage] 外国語で発行された書類で日本語訳が必要か
 */

/**
 * @typedef {Object} MinpakuApplicantProfile 届出者の総合入力データ
 * @property {string} applicantName 届出者氏名（法人の場合は法人名）
 * @property {string} [address] 住所
 * @property {string} [propertyAddress] 届出住宅の所在地
 * @property {"家主居住型" | "家主不在型"} residentType
 * @property {string} [managementCompanyName] 家主不在型の場合の委託先住宅宿泊管理業者名
 * @property {MinpakuKekkakuInput} kekkaku
 * @property {RequiredDocumentItem[]} requiredDocuments 必要書類の一覧
 */

export {};
