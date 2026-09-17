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
 *
 * 【2026年9月・e-Gov法令検索で確認して追加】遺言執行者の指定（民法1006条
 * 1項）は任意の記載事項であり、指定すると遺贈の履行等を遺言執行者のみが
 * 行えるようになる（1012条2項）等のメリットがある。`executorName`を
 * 指定した場合のみ本文に指定条項を追加し、未指定の場合は従来どおり
 * 条項自体を出力しない（後方互換）。
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
 * @typedef {Object} JihitsushoshoYuigonOptions
 * @property {string} [executorName] 遺言執行者として指定する者の氏名（民法1006条1項）。
 *   未指定の場合、遺言執行者の指定条項自体を出力しない
 */

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
 * 遺言執行者の指定条項の文面を組み立てる（民法1006条1項）。
 * `executorName`未指定の場合はnullを返し、本文に条項自体を追加しない
 * （後方互換）。
 * @param {JihitsushoshoYuigonOptions} [options]
 * @returns {string | null}
 */
export function resolveExecutorClauseText(options) {
  if (!options?.executorName) return null;
  return `遺言者は、本遺言の遺言執行者として次の者を指定する。${options.executorName}`;
}

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @param {JihitsushoshoYuigonOptions} [options]
 * @returns {Document}
 */
export function buildJihitsushoshoYuigonDocument(heirsResult, properties, options = {}) {
  const iryuubunWarnings = checkIryuubunTarget(heirsResult, properties);
  const executorClauseText = resolveExecutorClauseText(options);
  const bodyParagraphs = [
    new Paragraph({
      children: [
        new TextRun({
          text: "遺言者は、次のとおり遺言する。（以下、財産目録記載の各財産の取得者を、本文中に自書してください）",
          font: FONT,
        }),
      ],
    }),
  ];
  if (executorClauseText) {
    bodyParagraphs.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: executorClauseText, font: FONT })],
      })
    );
  }
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
          ...bodyParagraphs,
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: "財産目録（自書不要。各葉に署名・押印が必要）", font: FONT, bold: true })],
          }),
          buildLabeledTable(resolveJihitsushoshoZaisanMokurokuRows(properties)),
          ...buildBulletList("遺留分の目安に関する確認事項", iryuubunWarnings, { warning: iryuubunWarnings.length > 0 }),
          ...(executorClauseText
            ? buildBulletList("遺言執行者の指定について", [
                "遺言執行者は、遺言の内容を実現するため相続財産の管理その他遺言の執行に必要な一切の行為を行う権利義務を有します（民法1012条1項）。" +
                  "指定された方に事前に就任の意思を確認しておくことを推奨します。",
              ])
            : []),
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
 * @param {JihitsushoshoYuigonOptions} [options]
 */
export async function writeJihitsushoshoYuigonDocx(heirsResult, properties, outPath, options = {}) {
  await writeDocxFile(buildJihitsushoshoYuigonDocument(heirsResult, properties, options), outPath);
}
