/**
 * 合同会社の代表社員の互選書の記載内容サマリー生成。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】会社法599条3項により、持分会社
 * （合同会社を含む）は「定款」又は「定款の定めに基づく社員の互選」に
 * よって、業務を執行する社員の中から代表社員を定めることができる
 * （同条1項本文により、定めない場合は業務を執行する社員全員が各自
 * 代表する）。代表社員の指定は会社法第576条の絶対的記載事項ではなく、
 * 相対的記載事項に位置づけられる。
 *
 * `teikanSummary.js`は`FounderInput.isDaihyoShain`を「定款に直接記載する」
 * 前提で定款サマリーの「代表社員」行に反映するが、本モジュールは同じ
 * `isDaihyoShain`の指定を、社員間の互選の結果として書面化する（株式会社の
 * `hokininKetteisho.js`が定款外で発起人が決定する事項を書面化するのと
 * 同じ位置づけ）。定款に直接代表社員を記載する場合、本書面は法律上
 * 必須ではないが、社員間の合意を書面で残す実務的な価値がある。
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
 * @returns {[string, string][]}
 */
export function resolveDaihyoShainGosenshoRows(teikan) {
  if (teikan.companyType !== "合同会社") {
    throw new Error("代表社員の互選書は合同会社の設立でのみ使用します（株式会社は対象外）");
  }
  const founders = teikan.founders ?? [];
  const daihyoShainNames = founders.filter((f) => f.isDaihyoShain).map((f) => f.name);
  return [
    ["商号", orNotEntered(teikan.companyName)],
    ["社員（互選に加わった者）", orNotEntered(founders.map((f) => f.name).join("、"))],
    ["互選により定めた代表社員", daihyoShainNames.length > 0 ? daihyoShainNames.join("、") : "（未選出）"],
  ];
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @returns {Document}
 */
export function buildDaihyoShainGosenshoDocument(teikan) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("代表社員の互選書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveDaihyoShainGosenshoRows(teikan)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').TeikanInput} teikan
 * @param {string} outPath
 */
export async function writeDaihyoShainGosenshoDocx(teikan, outPath) {
  await writeDocxFile(buildDaihyoShainGosenshoDocument(teikan), outPath);
}
