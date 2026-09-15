/**
 * 様式生成モジュール共通のdocxヘルパー。
 *
 * すべての様式サマリーで見た目・注記文言を統一するために、
 * youshiki1.js で確立したパターン（A4・グレー見出しの2列表・赤字の注記）を
 * ここに切り出している。新しい様式モジュールを追加する場合はこれらを再利用し、
 * 同じ見た目のコードを様式ごとにコピーしないこと。
 */
import {
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

export const FONT = "Yu Gothic";

/** 必須項目が未入力の場合の表示文字列。 */
export const NOT_ENTERED = "（未入力）";

/**
 * 値が空（null/undefined/空文字/空配列）の場合に NOT_ENTERED を返す。
 * 様式生成モジュールはこの関数を通してから表の値として使うこと
 * （どのモジュールでも「未入力」の見え方を統一するため）。
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function orNotEntered(value) {
  return value ? value : NOT_ENTERED;
}

/**
 * A4サイズ・標準余白のセクション設定。
 */
export const A4_PAGE_PROPERTIES = {
  page: {
    size: { width: 11906, height: 16838 },
    margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
  },
};

/**
 * 様式タイトルの見出し段落を作る。
 * @param {string} text
 */
export function buildTitleHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: FONT, bold: true })],
  });
}

/**
 * 「これは正式提出様式ではない」旨の赤字注記段落を作る。
 * すべての様式生成モジュールが必ずこれを文書冒頭に含めること。
 */
export function buildDisclaimerParagraph() {
  return new Paragraph({
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
  });
}

/**
 * 見出し3相当の小見出し段落を作る（営業所ごとのセクション分けなどに使用）。
 * @param {string} text
 */
export function buildSubHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true })],
  });
}

/**
 * ラベル・値の2列表を組み立てる。値はすでに表示用文字列に解決済みであること
 * （「未入力」の判定・置換は各様式モジュールの resolve 関数側で行う）。
 * @param {[string, string][]} rows
 */
export function buildLabeledTable(rows) {
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
                  children: [new TextRun({ text: value, font: FONT, size: 20 })],
                }),
              ],
            }),
          ],
        })
    ),
  });
}

/**
 * ヘッダー行付きの複数列表を組み立てる（工事経歴書等、ラベル・値の2列に
 * 収まらない一覧データ用。M8）。値はすでに表示用文字列に解決済みであること。
 * `buildLabeledTable` とは別に用意しているのは、後者が「ラベル・値」固定の
 * 2列専用であるのに対し、こちらは列数・列見出しが様式によって変わる
 * 一覧表向けのため（工事経歴書、将来の財務諸表等での再利用を想定）。
 * @param {string[]} headers 列見出し
 * @param {string[][]} rows 各行のセル値（headersと同じ列数であること）
 * @param {{ columnWidths?: number[] }} [options] 列幅（DXA、合計9638目安）。省略時は均等割り
 */
export function buildHeaderedTable(headers, rows, options = {}) {
  const widths = options.columnWidths ?? headers.map(() => Math.floor(9638 / headers.length));

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (text, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 18, bold: true })] })],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (text, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 18 })] })],
            })
        ),
      })
  );

  return new Table({
    width: { size: 9638, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

/**
 * 判定理由・警告の一覧を箇条書き段落として組み立てる。
 * @param {string} heading
 * @param {string[]} items
 * @param {{ warning?: boolean }} [options] warning=true の場合、⚠ 付きの警告色で表示
 */
export function buildBulletList(heading, items, options = {}) {
  if (!items || items.length === 0) return [];
  const paragraphs = [
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: heading, font: FONT, bold: true, size: 20 })],
    }),
  ];
  for (const item of items) {
    paragraphs.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({
            text: options.warning ? `⚠ ${item}` : item,
            font: FONT,
            size: 20,
            color: options.warning ? "9C6500" : undefined,
          }),
        ],
      })
    );
  }
  return paragraphs;
}

/**
 * Document を .docx ファイルとして書き出す共通処理。
 * 出力先ディレクトリが存在しない場合は作成する（初回セットアップ時に
 * out/ ディレクトリが無くて失敗することを防ぐため）。
 * @param {import('docx').Document} doc
 * @param {string} outPath
 */
export async function writeDocxFile(doc, outPath) {
  const { Packer } = await import("docx");
  const buffer = await Packer.toBuffer(doc);
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buffer);
}
