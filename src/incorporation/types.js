/**
 * 会社設立サポートモジュールのデータ型定義（JSDoc）。
 *
 * 【設計原則】本モジュールは許可種別アドオン（`src/licenses/<種別>/`）ではなく、
 * コアの一部機能（docx共通ヘルパー・`bucketizeAlerts`等の表示関数）のみを
 * 再利用する独立した業務ドメイン（`docs/DESIGN_kaisha-secchi-support.md` 1章）。
 * `ApplicantProfile`・`ClientRecord`・`CaseRecord`（uketsuke-portal）とは
 * 意図的に型を共有しない。
 *
 * 【職域境界の担保（NFR-I3）】本ファイルおよび`documents/`配下には、
 * 登記申請書またはそれに類する様式（就任承諾書〈登記添付書類としての
 * もの〉・登記すべき事項の記録媒体等）に対応するフィールド・関数を
 * 一切持たせないこと。設立登記の申請は司法書士の独占業務である
 * （司法書士法第3条・第73条・第78条。要件定義書1.3節でe-Gov法令検索により
 * 確認済み）。
 */

/**
 * @typedef {Object} FounderInput 発起人（株式会社）または社員（合同会社）1名分の情報
 * @property {string} name 氏名又は名称（法人発起人の場合は法人名）
 * @property {string} address 住所
 * @property {number} investmentAmount 出資額（円）
 * @property {number} [investedShares] 引き受ける設立時発行株式数（株式会社のみ使用）
 * @property {boolean} [isDaihyoShain] 合同会社の代表社員として定款に定めるか（合同会社のみ使用。任意）
 */

/**
 * @typedef {Object} TeikanInput 定款作成に必要な入力データ
 *   絶対的記載事項（会社法第27条・第576条）を中心に構成する。
 *   【e-Gov法令検索で確認済み・2026年9月】株式会社（第27条）は5項目だが、
 *   合同会社（第576条）は「社員が無限責任社員又は有限責任社員のいずれで
 *   あるかの別」（同条第1項第5号）が追加され6項目になる。合同会社の場合、
 *   同条第4項により内容が「社員の全部を有限責任社員とする」旨に固定される
 *   ため、`FounderInput`に新規フィールドは追加せず、
 *   `resolveTeikanSummaryRows`（documents/teikanSummary.js）側で
 *   合同会社選択時に固定文言の行を追加する形で表現する。
 * @property {"株式会社" | "合同会社"} companyType 会社形態
 * @property {string} companyName 商号
 * @property {string[]} businessPurposes 目的（事業目的の一覧。登記事項でもある）
 * @property {string} headOfficeLocation 本店の所在地（定款上は最小行政区画〈市区町村〉までの記載でも可。具体的な所在場所は発起人決定書で定める場合がある）
 * @property {number} capitalAmount 設立に際して出資される財産の価額（又はその最低額）
 * @property {FounderInput[]} founders 発起人（株式会社）又は社員（合同会社）の一覧（1名以上）
 * @property {string} [fiscalYearEndMonth] 事業年度の末日（例: "3月31日"）。任意的記載事項だが実務上ほぼ必須
 * @property {string} [publicNoticeMethod] 公告方法（株式会社のみ想定の相対的記載事項。未記載の場合は官報とみなされる旨を明記して案内する）
 * @property {number} [totalIssuedShares] 設立に際して発行する株式の総数（株式会社のみ使用）
 */

/**
 * @typedef {Object} IncorporationCaseRecord 会社設立サポート案件1件分の情報
 * @property {string} caseId 一意なID
 * @property {string} clientName 依頼者（発起人代表・主たる連絡窓口）の氏名
 * @property {string} [contactEmail] 依頼者の連絡先メールアドレス
 * @property {TeikanInput} teikan 定款作成用データ
 * @property {"ヒアリング中" | "定款起案中" | "認証待ち" | "払込待ち" | "司法書士へ引継ぎ済み" | "完了"} status
 *   合同会社の案件は定款認証が無いため「認証待ち」を経ずに
 *   「定款起案中」→「払込待ち」へ進めてよい（厳密な遷移制約は設けない）
 * @property {string} [ninshoYoteiIso] 定款認証の予約日（YYYY-MM-DD）。株式会社のみ使用。合同会社では常にundefinedとする
 * @property {string} [funsoKigenIso] 出資金払込の期限日（YYYY-MM-DD）。発起人が定款または発起人の決定で定めた任意の期日
 * @property {string} [funsoKanryoIso] 出資金払込が完了した日（YYYY-MM-DD）。未設定＝未完了とみなす
 * @property {string} [handoffToShihoshoshiIso] 司法書士へ書類一式を引き継いだ日（任意記録。1.3節の職域境界を運用面で徹底するための記録項目）
 * @property {string} [notes] 自由記述メモ
 */

export {};
