/**
 * 建設業許可の要件判定に使うデータ型定義（JSDoc）。
 * このプロジェクトはビルドステップなしで動かすことを優先し、
 * TypeScriptではなく JSDoc + 素のJavaScript を採用している。
 * エディタ（VS Code等）を使えば型補完・型チェックはそのまま効く。
 */

/**
 * @typedef {Object} KeieiGyomuKanriInput 経営業務管理体制の判定に使う入力
 * @property {number} yearsAsResponsibleOfficer 建設業の経営業務管理責任者としての経験年数
 * @property {number} yearsAsQuasiResponsibleOfficer 経営業務管理責任者に準ずる地位での経験年数
 * @property {number} yearsAsAssistant 経営業務管理責任者を補佐する業務での経験年数
 * @property {boolean} isOfficerFor2Years 直近2年以上、常勤役員等の地位にあるか（複合要件ルート用）
 * @property {{finance: number, labor: number, operations: number}} assistantSupportYears
 *   財務管理・労務管理・業務運営の各業務について、5年以上補佐した者を配置している場合の年数
 * @property {boolean} hasSocialInsurance 健康保険・厚生年金保険・雇用保険に適切に加入しているか
 * @property {string} [responsibleName] 経営業務管理責任者（該当ルートの証明を受ける者）の氏名（様式第七号用・任意）
 * @property {string} [responsibleTitle] 当該者の地位・役名（様式第七号用・任意）
 */

/**
 * @typedef {Object} SenninGijutsushaInput 専任技術者の判定に使う入力（営業所単位）
 * @property {string} officeName 対象営業所名
 * @property {"一般" | "特定"} licenseType 一般建設業 or 特定建設業
 * @property {boolean} hasNationalLicense 該当する国家資格等を保有しているか
 * @property {boolean} isDesignatedCourseGraduate 指定学科を卒業しているか
 * @property {"高卒" | "大卒" | "その他" | null} educationLevel 学歴区分
 * @property {number} yearsOfPracticalExperience 指定学科卒業者としての実務経験年数（高卒5年/大卒3年の判定に使用）
 * @property {number} yearsOfGeneralExperience 指定学科によらない実務経験年数（10年要件の判定に使用）
 * @property {number} yearsOfSupervisoryExperience 4,500万円以上の工事における指導監督的実務経験年数（特定建設業用）
 * @property {string} [personName] 当該営業所の専任技術者の氏名（様式第八号用・任意）
 */

/**
 * @typedef {Object} ZaisanKisoInput 財産的基礎の判定に使う入力
 * @property {"一般" | "特定"} licenseType 一般建設業 or 特定建設業
 * @property {number} netAssets 自己資本額（円）
 * @property {number} fundingCapacity 資金調達能力（円。融資証明等で示せる額）
 * @property {boolean} hasFiveYearsContinuousOperation 直近5年間、許可を受けて継続して営業した実績があるか
 * @property {number} capitalAmount 資本金の額（円。特定建設業判定用）
 * @property {number} deficitRatio 欠損の額 ÷ 資本金 の比率（%。特定建設業判定用）
 * @property {number} currentRatio 流動比率（流動資産 ÷ 流動負債 × 100、%。特定建設業判定用）
 */

/**
 * @typedef {Object} KekkakuInput 欠格要件の判定に使う入力
 * @property {boolean} isUndischargedBankrupt 破産者で復権を得ていないか
 * @property {boolean} hadLicenseRevokedWithin5Years 5年以内に建設業許可を取り消された経験があるか
 * @property {boolean} hasCriminalRecordWithin5Years 禁錮以上の刑、または関連法令違反による罰金刑から5年を経過していないか
 * @property {boolean} isBoryokudanMemberOrWithin5Years 暴力団員である、または脱退から5年を経過していないか
 * @property {boolean} hasMentalImpairmentAffectingDuties 心身の故障により建設業を適正に営むことができないと認められるか
 * @property {boolean} hasFalseOrOmittedStatement 申請書・添付書類に虚偽の記載、または重要な事実の記載漏れがあるか
 */

/**
 * @typedef {Object} SeijitsuseiInput 誠実性の判定に使う入力（自己申告ベース）
 * @property {boolean} hasNoDishonestActRisk 請負契約に関して不正・不誠実な行為をするおそれが明らかでないと言えるか
 * @property {string} [notes] 判定の根拠・懸念点についての自由記述メモ
 */

/**
 * @typedef {Object} OfficerInput 役員等の一覧表（様式第六号）に記載する役員1名分の情報
 * @property {string} name 氏名
 * @property {string} title 役名（例: 代表取締役、取締役）
 * @property {string} [birthDate] 生年月日（YYYY-MM-DD、任意）
 */

/**
 * @typedef {Object} ApplicantProfile 申請者（会社・個人）の総合入力データ
 * @property {string} applicantName 申請者名（会社名 or 個人名）
 * @property {KeieiGyomuKanriInput} keieiGyomuKanri
 * @property {SenninGijutsushaInput[]} senninGijutsushaList 営業所ごとの専任技術者情報
 * @property {ZaisanKisoInput} zaisanKiso
 * @property {KekkakuInput} kekkaku
 * @property {SeijitsuseiInput} seijitsusei
 * @property {string} [representativeName] 代表者氏名（書類生成用・任意）
 * @property {string} [address] 主たる営業所の所在地（書類生成用・任意）
 * @property {string} [prefecture] 許可行政庁となる都道府県名（書類生成用・任意）
 * @property {string} [applicationDate] 申請年月日（YYYY-MM-DD、書類生成用・任意）
 * @property {string[]} [constructionTypes] 許可を受けようとする建設業の種類（書類生成用・任意）
 * @property {OfficerInput[]} [officers] 役員等の一覧（様式第六号用・任意）
 *
 * 全体の許可区分（一般/特定）は様式生成時、`zaisanKiso.licenseType` を正として用いる
 * （申請全体で1つの区分に定まるため、様式ごとに別フィールドへ二重定義しない）。
 */

/**
 * @typedef {Object} RequirementCheckResult 個別要件の判定結果
 * @property {string} key 要件のキー（例: "keieiGyomuKanri"）
 * @property {string} label 要件の日本語ラベル
 * @property {boolean} passed 要件を満たすか
 * @property {string[]} reasons 判定理由・根拠の説明（満たす場合も満たさない場合も記録する）
 * @property {string[]} warnings 要件は満たすが確認・追加書類が必要な点など
 */

/**
 * @typedef {Object} EligibilityResult 総合判定結果
 * @property {boolean} eligible 5要件すべてを満たすか
 * @property {RequirementCheckResult[]} checks 要件ごとの判定結果一覧
 * @property {string[]} blockingIssues 許可取得の妨げになっている理由の一覧（eligible=falseのとき）
 * @property {ConsistencyWarning[]} consistencyWarnings 入力内容の整合性チェック（M7・FR-6.1〜6.3）の注記一覧。
 *   合否判定（eligible/checks/blockingIssues）には一切影響しない「気づき」情報（FR-6.4）
 */

/**
 * @typedef {Object} ConsistencyWarning 入力内容の整合性チェック（ルールベース、M7）で検出した注記1件
 * @property {string} key 注記の種別キー（例: "representativeNameMismatch"）
 * @property {string} message 行政書士・申請者への確認を促すメッセージ（合否には影響しないことが分かる文言にする）
 */

export {};
