/**
 * 自筆証書遺言 文案の生成（FR-S3.1〜FR-S3.4）。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】民法968条1項により、自筆証書
 * 遺言は遺言者が全文・日付・氏名を自書し押印しなければならない。同条2項
 * （方式緩和）により、財産目録部分は自書を要しない（ただし各葉に署名・
 * 押印が必要）。本文と財産目録部分を明確に区別して出力する（FR-S3.1）。
 *
 * 遺留分の目安チェック（FR-S3.4）は、民法1042条（遺留分の帰属及びその
 * 割合。直系尊属のみが相続人である場合は1/3、それ以外〈兄弟姉妹を除く〉は
 * 1/2）に基づく機械的な近似計算であり、最終判断は専門家に委ねる。
 */
import { Document, Paragraph, TextRun, HeadingLevel } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
  FONT,
} from "../../core/documents/common.js";

const JIHITSU_FORMALITY_WARNING =
  "【最重要】本文は必ず遺言者本人が自書し、日付・氏名を自書のうえ押印してください。" +
  "代筆・パソコン作成した本文部分は無効になります（民法968条1項）。財産目録部分のみ、" +
  "自書によらない作成（パソコン作成・通帳のコピー等）が認められますが、その場合は" +
  "目録の各葉（両面に記載があるときは両面）に署名・押印が必要です（同条2項）。";

const HOKAN_SEIDO_NOTICE =
  "法務局における自筆証書遺言書保管制度の利用をご検討ください。原本の紛失・改ざんを" +
  "防止できるほか、相続開始後の家庭裁判所での検認手続きが不要になるメリットがあります。";

/**
 * 遺留分（民法1042条）の目安を下回る割当てがないかを機械的に近似計算する。
 * 兄弟姉妹には遺留分が無いため対象外とする（1042条1項柱書「兄弟姉妹以外の
 * 相続人は」）。財産の評価額が一部でも未入力の場合は、正確な判定ができない
 * 旨の警告のみを返す。
 *
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {string[]}
 */
export function checkIryuubunTarget(heirsResult, properties) {
  if (properties.some((p) => p.estimatedValueYen === undefined)) {
    return ["財産の一部で概算評価額が未入力のため、遺留分の目安計算は行えません（正式な評価額の算定は本モジュールの対象外です）。"];
  }
  const totalValue = properties.reduce((sum, p) => sum + (p.estimatedValueYen ?? 0), 0);
  if (totalValue <= 0) return [];

  const reservedPortionRatio = heirsResult.pattern === "直系尊属のみ" ? 1 / 3 : 1 / 2;
  const warnings = [];
  for (const heir of heirsResult.heirs) {
    if (heir.relation === "sibling-line") continue; // 兄弟姉妹に遺留分は無い（1042条）
    const [n, d] = heir.shareFraction.includes("/") ? heir.shareFraction.split("/").map(Number) : [Number(heir.shareFraction), 1];
    const legalShareRatio = n / d;
    const reservedValue = totalValue * legalShareRatio * reservedPortionRatio;
    const assignedValue = properties
      .filter((p) => p.assignedHeirPersonId === heir.personId)
      .reduce((sum, p) => sum + (p.estimatedValueYen ?? 0), 0);
    if (assignedValue < reservedValue) {
      warnings.push(
        `${orNotEntered(heir.label ?? heir.personId)}への割当て（${assignedValue.toLocaleString()}円）が、` +
          `遺留分の目安（約${Math.round(reservedValue).toLocaleString()}円）を下回っている可能性があります。` +
          `最終的な該当性の判断は専門家にご相談ください。`
      );
    }
  }
  return warnings;
}

/**
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {[string, string][]}
 */
export function resolveJihitsushoshoZaisanMokurokuRows(properties) {
  return properties.map(
    /** @returns {[string, string]} */
    (p) => [`${p.category} ${orNotEntered(p.description)}`, orNotEntered(p.assignedHeirPersonId)]
  );
}

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {Document}
 */
export function buildJihitsushoshoYuigonDocument(heirsResult, properties) {
  const iryuubunWarnings = checkIryuubunTarget(heirsResult, properties);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("自筆証書遺言 文案"),
          buildDisclaimerParagraph(),
          ...buildBulletList("方式に関する重要な注意事項", [JIHITSU_FORMALITY_WARNING], { warning: true }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: "本文（遺言者本人が自書する部分）", font: FONT, bold: true })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "遺言者は、次のとおり遺言する。（以下、財産目録記載の各財産の取得者を、本文中に自書してください）",
                font: FONT,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: "財産目録（自書不要。各葉に署名・押印が必要）", font: FONT, bold: true })],
          }),
          buildLabeledTable(resolveJihitsushoshoZaisanMokurokuRows(properties)),
          ...buildBulletList("遺留分の目安に関する確認事項", iryuubunWarnings, { warning: iryuubunWarnings.length > 0 }),
          ...buildBulletList("保管制度のご案内", [HOKAN_SEIDO_NOTICE]),
        ],
      },
    ],
  });
}

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @param {string} outPath
 */
export async function writeJihitsushoshoYuigonDocx(heirsResult, properties, outPath) {
  await writeDocxFile(buildJihitsushoshoYuigonDocument(heirsResult, properties), outPath);
}
