/**
 * 許可種別に依存しない、要件判定の共通データ型定義（JSDoc）。
 *
 * 【設計原則】このファイルには「建設業」「古物商」といった固有の許可種別名・
 * 法令名を一切含めないこと（docs/DESIGN_kobutsu-core.md 1章参照）。
 * ApplicantProfile のような許可種別固有の巨大な型は各
 * src/licenses/<種別>/eligibility/types.js に置く。
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
 * @property {boolean} eligible すべての要件を満たすか
 * @property {RequirementCheckResult[]} checks 要件ごとの判定結果一覧
 * @property {string[]} blockingIssues 許可取得の妨げになっている理由の一覧（eligible=falseのとき）
 * @property {ConsistencyWarning[]} [consistencyWarnings] 入力内容の整合性チェックの注記一覧（許可種別によっては未実装でもよいため任意）。
 *   合否判定（eligible/checks/blockingIssues）には一切影響しない「気づき」情報
 */

/**
 * @typedef {Object} ConsistencyWarning 入力内容の整合性チェックで検出した注記1件
 * @property {string} key 注記の種別キー（例: "representativeNameMismatch"）
 * @property {string} message 確認を促すメッセージ（合否には影響しないことが分かる文言にする）
 */

export {};
