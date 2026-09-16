/**
 * 定款の記載内容サマリー生成（FR-I1.3）。会社形態によって出力項目が
 * 分岐する点が、本モジュールの書類生成の最大の特徴である。建設業許可の
 * `youshiki1.js`・古物商許可の`shinseisho.js`と同じ3関数パターン
 * （`resolve<様式名>Rows` / `build<様式名>Document` / `write<様式名>Docx`）
 * を踏襲する。
 *
 * 【重要】これは実際の定款そのものではなく、内容確認用のサマリーである。
 * 正式な定款条文（前文・各条の体裁）への清書は、発注者本人が別途行う。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

/**
 * 発起人（社員）の出資額合計が、設立に際して出資される財産の価額と
 * 整合しているかを確認する（FR-I1.5）。不整合でも生成自体は妨げない。
 * @param {import('../types.js').TeikanInput} teikan
 * @returns {string[]} 警告メッセージの配列（整合していれば空配列）
 */
export function checkCapitalConsistency(teikan) {
  const founders = teikan.founders ?? [];
  const totalInvestment = founders.reduce((sum, f) => sum + (f.investmentAmount || 0), 0);
  if (founders.length > 0 && teikan.capitalAmount !== undefined && totalInvestment !== teikan.capitalAmount) {
    return [
      `発起人（社員）の出資額合計（${totalInvestment.toLocaleString()}円）が、設立に際して出資される財産の価額（${teikan.capitalAmount.toLocaleString()}円）と一致していません。入力内容を確認してください。`,
    ];
  }
  return [];
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @returns {[string, string][]}
 */
export function resolveTeikanSummaryRows(teikan) {
  const isKabu = teikan.companyType === "株式会社";
  /** @type {[string, string][]} */
  const rows = [
    ["会社形態", teikan.companyType],
    ["商号", orNotEntered(teikan.companyName)],
    ["目的", orNotEntered(teikan.businessPurposes?.join("\n"))],
    ["本店の所在地", orNotEntered(teikan.headOfficeLocation)],
    ["設立に際して出資される財産の価額", `${teikan.capitalAmount?.toLocaleString() ?? "未入力"}円`],
    [
      isKabu ? "発起人" : "社員",
      orNotEntered(teikan.founders?.map((f) => `${f.name}（${f.address}・${f.investmentAmount.toLocaleString()}円）`).join("\n")),
    ],
  ];
  if (teikan.fiscalYearEndMonth) rows.push(["事業年度", teikan.fiscalYearEndMonth]);
  if (isKabu) {
    // 株式会社のみの項目。合同会社ではこれらの行自体を出力しない（FR-I1.4・FR-I4.2）。
    rows.push(["発行可能株式総数等", orNotEntered(String(teikan.totalIssuedShares ?? ""))]);
    rows.push(["公告方法", teikan.publicNoticeMethod || "未記載（未記載の場合は官報公告とみなされます）"]);
    rows.push(["定款認証", "必要（公証役場での認証手続きが必須です）"]);
  } else {
    // 合同会社は会社法第576条第1項第5号（社員が無限責任社員又は有限責任社員の
    // いずれであるかの別）が株式会社側に対応項目のない絶対的記載事項として
    // 追加される。合同会社の場合は同条第4項により内容が固定されるため、
    // 定型文として出力する（e-Gov法令検索で確認済み・2026年9月）。
    rows.push(["社員の責任", "社員の全部を有限責任社員とする（会社法第576条第1項第5号・第4項）"]);
    // 合同会社は定款認証が不要である旨を明記する（要件定義書1.3節・4.4節）。
    rows.push(["定款認証", "不要（持分会社のため、公証人の認証手続きはありません）"]);
  }
  return rows;
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @returns {Document}
 */
export function buildTeikanSummaryDocument(teikan) {
  const warnings = checkCapitalConsistency(teikan);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`${teikan.companyType} 定款 — 記載内容サマリー`),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveTeikanSummaryRows(teikan)),
          ...buildBulletList("確認事項", warnings, { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @param {string} outPath
 */
export async function writeTeikanSummaryDocx(teikan, outPath) {
  await writeDocxFile(buildTeikanSummaryDocument(teikan), outPath);
}
