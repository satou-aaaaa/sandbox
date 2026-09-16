/**
 * BtoB下請けケース管理ポータルのデータ型定義（JSDoc）。
 *
 * 【設計原則】本モジュールは許可種別アドオン（`src/licenses/<種別>/`）ではなく、
 * コアの一部機能（docx共通ヘルパー・永続化パターン・`bucketizeAlerts`等の
 * 表示関数）のみを再利用する独立した業務ドメイン。`ApplicantProfile`・
 * `ClientRecord`とは意図的に型を共有しない（NFR-U2。最終顧客の詳細な
 * 個人情報を持たない設計を型レベルで担保する。docs/DESIGN_uketsuke-portal.md
 * 3章参照）。
 */

/**
 * @typedef {Object} PartnerRecord 元請行政書士1件分の情報
 * @property {string} partnerId 一意なID（例: 事務所名のスラッグ）
 * @property {string} partnerName 事務所名・氏名
 * @property {string} [contactName] 担当者名
 * @property {string} [contactEmail] 連絡先メールアドレス
 */

/**
 * @typedef {Object} CaseRecord 案件1件分の情報
 * @property {string} caseId 一意なID
 * @property {string} partnerId どの元請行政書士からの依頼か（PartnerRecord.partnerIdを参照）
 * @property {string} caseName 案件名（例: "○○様 建設業許可新規申請 書類作成"）
 * @property {string} [licenseCategory] 対象許可種別（任意。コアのlicenseCategoryキーと合わせてもよいし自由記述でもよい）
 * @property {string} receivedDateIso 受注日
 * @property {string} dueDateIso 納期
 * @property {number} feeAmount 報酬額（円）
 * @property {"受付" | "作業中" | "納品待ち" | "完了" | "保留"} status
 * @property {string} [notes] 自由記述メモ
 */

export {};
