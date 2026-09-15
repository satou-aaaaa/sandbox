/**
 * 古物商許可の要件判定に使うデータ型定義（JSDoc）。
 * 法人申請は本フェーズ対象外のため、法人固有フィールド（役員一覧等）は
 * 持たない（docs/REQUIREMENTS_kobutsu-core.md 4.6節スコープ外）。
 */

/**
 * @typedef {Object} KobutsuKekkakuInput 欠格事由（古物営業法第4条）の判定に使う入力
 *   フィールドの号立ては docs/REQUIREMENTS_kobutsu-core.md 8.1節のとおり、
 *   2026年9月にe-Gov法令検索の原文（令和7年6月1日施行版）で確認済み。
 *   第十号（管理者選任の見込みなし）は行政庁の裁量的判断のため本型には
 *   含めず、FR-K1.3・checkKobutsuEigyoshoで実務上カバーする。第十一号
 *   （法人役員の欠格）は個人申請のみが対象のため対象外。
 * @property {boolean} isUndischargedBankrupt 破産手続開始の決定を受けて復権を得ないか（第一号）
 * @property {boolean} hasCriminalRecordWithin5Years 拘禁刑以上の刑、又は第31条・刑法上の特定の罪により罰金の刑に処せられ5年を経過しないか（第二号。「拘禁刑」は令和7年6月1日施行の現行用語。「禁錮」ではない）
 * @property {boolean} hasBoryokuFuhouKoiRisk 集団的・常習的な暴力的不法行為等を行うおそれがあるか（第三号）
 * @property {boolean} hasBoryokudanRelatedOrderWithin3Years 暴力団関連の命令・指示を受け3年を経過しないか（第四号）
 * @property {boolean} isAddressUnknown 住居の定まらない者か（第五号）
 * @property {boolean} hadLicenseRevokedWithin5Years 古物商・古物市場主の許可取消しから5年を経過しないか（第六号）
 * @property {boolean} hasSurrenderedLicenseDuringRevocationHearingWithin5Years 許可取消しの聴聞公示後、取消しを免れるため許可証を返納した者（廃止について相当な理由がある者を除く）で返納から5年を経過しないか（第七号。第六号の現に取消された場合とは別の独立した欠格事由）
 * @property {boolean} hasMentalImpairmentAffectingDuties 心身の故障により業務を適正に行うことができない者として国家公安委員会規則で定めるものか（第八号）
 * @property {boolean} isMinorWithoutCapacity 営業に関し成年者と同一の行為能力を有しない未成年者か（第九号。例外規定の該当有無は別フィールドで扱う）
 * @property {boolean} [isHeirWithQualifiedLegalRepresentative] 未成年者だが、古物商・古物市場主の相続人であり、かつその法定代理人が欠格事由（一号〜八号・十一号）のいずれにも該当しない場合の例外に該当するか（任意。該当する場合のみtrue。「法定代理人の許可があれば良い」という一般的な話ではなく、事業相続のケースに限定される点に注意）
 */

/**
 * @typedef {Object} KobutsuEigyoshoInput 営業所・管理者要件の判定に使う入力（営業所単位）
 * @property {string} officeName 対象営業所名
 * @property {boolean} hasLegitimateUsageRight 営業所の実在性・使用権限（賃貸借契約書等）を確認済みか
 * @property {string} managerName 管理者の氏名
 * @property {boolean} isManagerFullTime 管理者が常勤であるか（【注意】この「常勤性」要件は古物営業法第13条の条文本文には記載がなく、施行規則または実務運用に由来すると見られるが2026年9月時点で一次資料未確認。そのためkekkaku.js側の欠格事由としてではなく、機械的に判定しきれない項目として人手確認を促す警告の扱いに留める。docs/REQUIREMENTS_kobutsu-core.md 8.2節参照）
 */

/**
 * @typedef {Object} KobutsuApplicantProfile 申請者（個人）の総合入力データ
 * @property {string} applicantName 申請者氏名
 * @property {string} [applicantNameKana] 申請者氏名のフリガナ
 * @property {string} [birthDate] 生年月日（YYYY-MM-DD、任意）
 * @property {string} [address] 住所
 * @property {string} [phoneNumber] 電話番号
 * @property {string} [businessName] 屋号（任意）
 * @property {KobutsuKekkakuInput} kekkaku
 * @property {KobutsuEigyoshoInput[]} eigyoshoList 営業所ごとの情報（1件以上）
 * @property {string[]} [handledItemCategories] 取り扱う古物の区分（例: ["古物一般"]。届出書上は13区分から選択）
 * @property {boolean} [usesInternet] インターネットを利用して取引を行うか
 * @property {string} [url] インターネット利用時のURL（届出対象。任意）
 * @property {string} [representativeHistory] 略歴書用の職歴・経歴の自由記述（過去5年分が目安。任意）
 */

export {};
