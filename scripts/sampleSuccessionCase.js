/**
 * 相続支援モジュールのサンプルスクリプト共通のダミー案件データ。
 * 実在の相続人・被相続人データは絶対に使用しない（NFR-5）。すべてダミー値。
 *
 * @returns {import('../src/succession/types.js').SuccessionCaseRecord}
 */
export function buildSampleSuccessionCase() {
  return {
    caseId: "case-souzoku-001",
    caseLabel: "サンプル家 相続手続き",
    decedentDeathDateIso: "2026-06-01",
    familyStructure: {
      caseId: "case-souzoku-001",
      decedentDeathDateIso: "2026-06-01",
      hasSpouse: true,
      spouseIsAlive: true,
      children: [
        { personId: "child-1", label: "長男", isAlive: true },
        { personId: "child-2", label: "長女", isAlive: true },
      ],
      ascendants: [],
      siblings: [],
    },
    properties: [
      { itemId: "prop-1", category: "不動産", description: "サンプル県サンプル市の自宅土地建物", estimatedValueYen: 20_000_000 },
      { itemId: "prop-2", category: "預貯金", description: "サンプル銀行サンプル支店 普通預金", estimatedValueYen: 5_000_000 },
    ],
    status: "遺産分割協議書作成中",
    hasDisputeAmongHeirs: false,
  };
}
