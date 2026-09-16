/**
 * BtoB下請けケース管理ポータルの書類生成サンプルスクリプト共通のダミーデータ。
 * 実在の元請行政書士・案件データは絶対に使用しない（NFR-5）。すべてダミー値。
 */

/** @returns {import('../src/portal/types.js').PartnerRecord} */
export function buildSamplePartner() {
  return {
    partnerId: "sample-law-office",
    partnerName: "サンプル行政書士法人",
    contactName: "田中 次郎",
    contactEmail: "tanaka@example.com",
  };
}

/** @returns {import('../src/portal/types.js').CaseRecord} */
export function buildSampleCase() {
  return {
    caseId: "case-001",
    partnerId: "sample-law-office",
    caseName: "○○様 建設業許可新規申請 書類作成",
    licenseCategory: "construction",
    receivedDateIso: "2026-09-01",
    dueDateIso: "2026-10-15",
    feeAmount: 80000,
    status: "作業中",
  };
}
