/**
 * 発起人決定書の記載内容サマリー生成（FR-I2.1）。定款で定めなかった事項
 * （本店の具体的な所在場所・設立時代表取締役の選定等）を発起人の決定として
 * 書面化するものであり、株式会社の設立でのみ用いる（合同会社は業務執行
 * 社員・代表社員の定めを定款自体に記載するのが実務上一般的なため、本
 * フェーズでは対象外とする）。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @param {{ honTenShozaiChi?: string, daihyoTorishimariyaku?: string }} decisions
 *   本店の具体的所在場所（地番まで）・設立時代表取締役の氏名等、
 *   定款外で発起人が決定する事項
 * @returns {[string, string][]}
 */
export function resolveHokininKetteishoRows(teikan, decisions) {
  if (teikan.companyType !== "株式会社") {
    throw new Error("発起人決定書は株式会社の設立でのみ使用します（合同会社は対象外）");
  }
  return [
    ["商号", orNotEntered(teikan.companyName)],
    ["本店の具体的所在場所", orNotEntered(decisions?.honTenShozaiChi)],
    ["設立時代表取締役", orNotEntered(decisions?.daihyoTorishimariyaku)],
    ["発起人（決定に加わった者）", orNotEntered(teikan.founders?.map((f) => f.name).join("、"))],
  ];
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @param {{ honTenShozaiChi?: string, daihyoTorishimariyaku?: string }} decisions
 * @returns {Document}
 */
export function buildHokininKetteishoDocument(teikan, decisions) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("発起人決定書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveHokininKetteishoRows(teikan, decisions)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @param {{ honTenShozaiChi?: string, daihyoTorishimariyaku?: string }} decisions
 * @param {string} outPath
 */
export async function writeHokininKetteishoDocx(teikan, decisions, outPath) {
  await writeDocxFile(buildHokininKetteishoDocument(teikan, decisions), outPath);
}
