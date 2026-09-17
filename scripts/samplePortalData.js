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

/**
 * 月次請求サマリー（monthlySeikyusho.js）のサンプル生成用に、
 * 同一元請の複数案件（完了月・未完了が混在）をまとめて返す。
 * @returns {import('../src/portal/types.js').CaseRecord[]}
 */
export function buildSampleCases() {
  return [
    {
      caseId: "case-001",
      partnerId: "sample-law-office",
      caseName: "○○様 建設業許可新規申請 書類作成",
      licenseCategory: "construction",
      receivedDateIso: "2026-08-01",
      dueDateIso: "2026-09-10",
      feeAmount: 80000,
      status: "完了",
      completedDateIso: "2026-09-08",
    },
    {
      caseId: "case-002",
      partnerId: "sample-law-office",
      caseName: "△△様 古物商許可申請 書類作成",
      licenseCategory: "kobutsu",
      receivedDateIso: "2026-08-15",
      dueDateIso: "2026-09-20",
      feeAmount: 50000,
      status: "完了",
      completedDateIso: "2026-09-18",
    },
    {
      caseId: "case-003",
      partnerId: "sample-law-office",
      caseName: "□□様 経審書類作成",
      licenseCategory: "keiei-jiko-shinsa",
      receivedDateIso: "2026-09-01",
      dueDateIso: "2026-10-05",
      feeAmount: 60000,
      status: "作業中", // 対象月のうちにまだ完了していない案件（月次請求サマリーには含まれない）
    },
  ];
}
