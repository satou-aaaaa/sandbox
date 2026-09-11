/**
 * 様式第一号（建設業許可申請書）の自動生成モジュール。
 *
 * 【現状のスコープ】国が定める正式な様式は複雑な罫線レイアウトの帳票のため、
 * 本モジュールは「様式のレイアウトを完全再現した提出用PDF」ではなく、
 * 申請に必要な情報を整理して確認できる「申請内容サマリー（下書き・チェック用）」を
 * docx として出力する。将来的に正式様式のPDFフォーム（AcroForm）に
 * 直接流し込む方式へ拡張する前提の、書類生成パイプラインの土台として位置づける。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  AlignmentType,
} from "docx";

const FONT = "Yu Gothic";

/**
 * @typedef {Object} Youshiki1Data
 * @property {string} applicantName 商号又は名称
 * @property {string} representativeName 代表者氏名
 * @property {string} address 主たる営業所の所在地
 * @property {"一般" | "特定"} licenseType
 * @property {string[]} constructionTypes 許可を受けようとする建設業の種類（例: ["建築工事業", "電気工事業"]）
 * @property {string} prefecture 許可行政庁（都道府県名）
 * @property {string} applicationDate 申請年月日（YYYY-MM-DD）
 */

/**
 * 申請内容サマリーの Document オブジェクトを組み立てる。
 * @param {Youshiki1Data} data
 * @returns {Document}
 */
export function buildYoushiki1Document(data) {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "建設業許可申請書（様式第一号）— 申請内容サマリー", font: FONT, bold: true })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "※ これは正式提出様式ではなく、内容確認・下書き用のサマリーです。提出前に必ず正式様式へ転記してください。",
                font: FONT,
                size: 18,
                italics: true,
                color: "AA0000",
              }),
            ],
          }),
          buildInfoTable(data),
        ],
      },
    ],
  });
}

/** @param {Youshiki1Data} data */
function buildInfoTable(data) {
  const rows = [
    ["申請年月日", data.applicationDate],
    ["許可行政庁", data.prefecture],
    ["許可の種類", data.licenseType === "特定" ? "特定建設業" : "一般建設業"],
    ["商号又は名称", data.applicantName],
    ["代表者氏名", data.representativeName],
    ["主たる営業所の所在地", data.address],
    ["許可を受けようとする建設業の種類", data.constructionTypes.join("、")],
  ];

  return new Table({
    width: { size: 9638, type: WidthType.DXA },
    columnWidths: [3000, 6638],
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3000, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 20, bold: true })] }),
              ],
            }),
            new TableCell({
              width: { size: 6638, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: value || "（未入力）", font: FONT, size: 20 })],
                }),
              ],
            }),
          ],
        })
    ),
  });
}

/**
 * 申請内容サマリーを .docx ファイルとして書き出す。
 * @param {Youshiki1Data} data
 * @param {string} outPath
 */
export async function writeYoushiki1Docx(data, outPath) {
  const doc = buildYoushiki1Document(data);
  const buffer = await Packer.toBuffer(doc);
  const fs = await import("node:fs/promises");
  await fs.writeFile(outPath, buffer);
}
