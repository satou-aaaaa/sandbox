/**
 * 会社設立サポートモジュールのサンプルスクリプト共通のダミー案件データ。
 * 実在の依頼者・発起人データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/incorporation/types.js').IncorporationCaseRecord}
 */
export function buildSampleKabushikiKaishaCase() {
  return {
    caseId: "case-kabu-001",
    clientName: "サンプル太郎",
    contactEmail: "sample-taro@example.com",
    teikan: {
      companyType: "株式会社",
      companyName: "サンプル商事株式会社",
      businessPurposes: ["ソフトウェアの開発及び販売", "前号に附帯する一切の業務"],
      headOfficeLocation: "東京都サンプル区",
      capitalAmount: 3_000_000,
      founders: [
        { name: "サンプル太郎", address: "東京都サンプル区1-2-3", investmentAmount: 3_000_000, investedShares: 30 },
      ],
      fiscalYearEndMonth: "3月31日",
      publicNoticeMethod: "官報に掲載する方法",
      totalIssuedShares: 30,
    },
    status: "定款起案中",
  };
}

/**
 * @returns {import('../src/incorporation/types.js').IncorporationCaseRecord}
 */
export function buildSampleGodoKaishaCase() {
  return {
    caseId: "case-godo-001",
    clientName: "サンプル花子",
    contactEmail: "sample-hanako@example.com",
    teikan: {
      companyType: "合同会社",
      companyName: "サンプル工房合同会社",
      businessPurposes: ["雑貨の製造及び販売", "前号に附帯する一切の業務"],
      headOfficeLocation: "大阪府サンプル市",
      capitalAmount: 1_000_000,
      founders: [{ name: "サンプル花子", address: "大阪府サンプル市4-5-6", investmentAmount: 1_000_000, isDaihyoShain: true }],
      fiscalYearEndMonth: "12月31日",
    },
    status: "定款起案中",
  };
}
