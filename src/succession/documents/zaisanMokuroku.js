/**
 * 財産目録サマリーの生成（FR-S2.1）。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildHeaderedTable,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

/**
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {string[][]}
 */
export function resolveZaisanMokurokuRows(properties) {
  return properties.map((p) => [
    p.category,
    orNotEntered(p.description),
    p.estimatedValueYen !== undefined ? `${p.estimatedValueYen.toLocaleString()}円` : "（未入力）",
  ]);
}

/**
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {Document}
 */
export function buildZaisanMokurokuDocument(properties) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("財産目録"),
          buildDisclaimerParagraph(),
          buildHeaderedTable(["区分", "内容", "概算評価額（参考値）"], resolveZaisanMokurokuRows(properties)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').PropertyItem[]} properties
 * @param {string} outPath
 */
export async function writeZaisanMokurokuDocx(properties, outPath) {
  await writeDocxFile(buildZaisanMokurokuDocument(properties), outPath);
}
