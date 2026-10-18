/**
 * 様式第二号（工事経歴書）の「罫線版」生成モジュール（Issue #76・ADR-0021）。
 *
 * サマリー版（youshiki2.js）は内容確認用の一覧表だが、こちらは正式様式の
 * 欄の並び（注文者／元請又は下請の別／JVの別／工事名／工事現場の所在地／
 * 配置技術者／請負代金の額とその内訳／工期）と罫線をdocxで再現し、
 * 建設工事の種類（業種）ごとに1枚ずつ出力する。転記の手間を減らすのが目的で、
 * 正式様式の完全な複製ではない（方式B。docs/adr/0021-formal-layout-docx-reproduction.md）。
 *
 * 参照（法令根拠・様式の一次資料）:
 * - 建設業法施行規則 様式第二号（工事経歴書）と記載要領
 *   https://laws.e-gov.go.jp/data/MinisterialOrdinance/324M50004000014/621062_1/pict/2FH00000061301.pdf
 * - 建設業法施行規則（e-Gov法令検索）
 *   https://laws.e-gov.go.jp/law/324M50004000014
 *
 * 【意図的に自動化していないこと】
 * - JVの別・工事現場のある都道府県及び市区町村名・請負代金の額の内訳
 *   （PC・法面処理・鋼橋上部）は入力項目が無いため空欄で出し、手書きで補う。
 * - 税込・税抜の別は入力から判断できないため「税込・税抜」を両方印字し、
 *   該当しない方を消してもらう（サマリー版と同じく換算はしない）。
 * - 掲載件数の絞り込み・未成工事の区分は行わない（サマリー版と同じ）。
 * - 正式様式の「小計」はページごとの欄だが、docxでは改ページ位置が
 *   閲覧環境で変わるため、業種ごとの「合計」だけを出す。
 *
 * 押印・提出前の最終確認は常に人が行う（CLAUDE.md「人手レビュー必須」）。
 */
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  VerticalMergeType,
  PageOrientation,
  ShadingType,
} from "docx";
import {
  FONT,
  buildFormLayoutDisclaimerParagraph,
  buildBulletList,
  writeDocxFile,
} from "../core/documents/common.js";
import { compareWorkRecords } from "./youshiki2.js";

/** 業種が未入力の工事をまとめるシートの見出し。 */
export const UNKNOWN_CONSTRUCTION_TYPE = "（建設工事の種類未入力）";

/**
 * 列幅（DXA）。A4横・左右余白1134の本文幅 14570 に収まるように配分する。
 * 並びは COLUMN_KEYS と同じ。
 */
const COLUMN_WIDTHS = [1800, 700, 600, 2570, 1400, 1200, 600, 600, 1300, 600, 600, 600, 1000, 1000];

/** 手書きで追記できるよう、1枚の表は最低でもこの行数まで空行で埋める。 */
export const MIN_TABLE_ROWS = 10;

/**
 * @typedef {Object} Youshiki2FormRow 罫線版の1行（すべて表示用文字列に解決済み）
 * @property {string} orderer 注文者
 * @property {string} contractorType 元請又は下請の別
 * @property {string} jointVenture JVの別（入力項目が無いため常に空欄）
 * @property {string} projectName 工事名
 * @property {string} siteLocation 工事現場のある都道府県及び市区町村名（常に空欄）
 * @property {string} engineerName 配置技術者の氏名
 * @property {string} chiefEngineerMark 主任技術者ならレ
 * @property {string} supervisingEngineerMark 監理技術者ならレ
 * @property {string} amountThousandYen 請負代金の額（千円）
 * @property {string} startMonth 着工年月
 * @property {string} completionMonth 完成又は完成予定年月
 */

/**
 * @typedef {Object} Youshiki2FormSheet 業種ごとの1枚分
 * @property {string} constructionType 建設工事の種類
 * @property {Youshiki2FormRow[]} rows
 * @property {number} totalCount 合計件数
 * @property {string} totalAmountThousandYen 合計金額（千円）
 * @property {number} primeCount うち元請工事の件数
 * @property {string} primeAmountThousandYen うち元請工事の金額（千円）
 */

/**
 * 円を千円単位の表示文字列にする（千円未満は切り捨て）。数値でなければ空欄。
 * @param {number} amount
 * @returns {string}
 */
export function toThousandYen(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  return Math.floor(amount / 1000).toLocaleString("ja-JP");
}

/**
 * "YYYY-MM" を "YYYY年M月" にする。形式が違えばそのまま、空なら空欄。
 * @param {string | undefined} iso
 * @returns {string}
 */
export function formatYearMonth(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{1,2})/.exec(iso);
  return m ? `${m[1]}年${Number(m[2])}月` : iso;
}

/**
 * 合計金額（千円）。数値でない金額は合計に含めない。
 * @param {import('../licenses/construction/eligibility/types.js').WorkRecordInput[]} records
 * @returns {string}
 */
function sumThousandYen(records) {
  const total = records
    .map((r) => r.contractAmount)
    .filter((a) => typeof a === "number" && Number.isFinite(a))
    .reduce((acc, a) => acc + a, 0);
  return toThousandYen(total);
}

/**
 * ApplicantProfile.constructionHistory を業種ごとのシートに分ける。
 * 業種の並びは profile.constructionTypes の順（載っていない業種は入力順で後ろ）、
 * 各シートの行は正式な記載順序（元請が先、各グループ内は請負代金の額の大きい順）。
 *
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @returns {Youshiki2FormSheet[]}
 */
export function resolveYoushiki2FormSheets(profile) {
  const records = profile.constructionHistory ?? [];
  /** @type {Map<string, import('../licenses/construction/eligibility/types.js').WorkRecordInput[]>} */
  const groups = new Map();
  for (const record of records) {
    const key = record.constructionType || UNKNOWN_CONSTRUCTION_TYPE;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }

  const declared = profile.constructionTypes ?? [];
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = declared.indexOf(a);
    const ib = declared.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return keys.map((constructionType) => {
    const list = [...(groups.get(constructionType) ?? [])].sort(compareWorkRecords);
    const prime = list.filter((r) => !r.isSubcontract);
    return {
      constructionType,
      rows: list.map((r) => ({
        orderer: r.orderer ?? "",
        contractorType: r.isSubcontract ? "下請" : "元請",
        jointVenture: "",
        projectName: r.projectName ?? "",
        siteLocation: "",
        engineerName: r.assignedEngineerName ?? "",
        chiefEngineerMark: r.engineerRole === "主任技術者" ? "レ" : "",
        supervisingEngineerMark: r.engineerRole === "監理技術者" ? "レ" : "",
        amountThousandYen: toThousandYen(r.contractAmount),
        startMonth: formatYearMonth(r.startDateIso),
        completionMonth: formatYearMonth(r.completionDateIso),
      })),
      totalCount: list.length,
      totalAmountThousandYen: sumThousandYen(list),
      primeCount: prime.length,
      primeAmountThousandYen: sumThousandYen(prime),
    };
  });
}

/**
 * 罫線付きのセルを作る。
 * @param {string} text
 * @param {number} width DXA
 * @param {{ columnSpan?: number, verticalMerge?: "restart" | "continue", header?: boolean, align?: "left" | "center" | "right" }} [options]
 */
function cell(text, width, options = {}) {
  const alignment =
    options.align === "right" ? AlignmentType.RIGHT : options.align === "left" ? AlignmentType.LEFT : AlignmentType.CENTER;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: options.columnSpan,
    verticalMerge:
      options.verticalMerge === "restart"
        ? VerticalMergeType.RESTART
        : options.verticalMerge === "continue"
          ? VerticalMergeType.CONTINUE
          : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.header ? { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment,
        children: [new TextRun({ text, font: FONT, size: options.header ? 14 : 16 })],
      }),
    ],
  });
}

/**
 * 列幅の合計（columnSpan のセル幅用）。
 * @param {number} from 開始列
 * @param {number} count 列数
 * @returns {number}
 */
function spanWidth(from, count) {
  return COLUMN_WIDTHS.slice(from, from + count).reduce((a, b) => a + b, 0);
}

/** 正式様式どおりの2段の見出し行を作る。 */
function buildHeaderRows() {
  const w = COLUMN_WIDTHS;
  const top = new TableRow({
    tableHeader: true,
    children: [
      cell("注文者", w[0], { header: true, verticalMerge: "restart" }),
      cell("元請又は下請の別", w[1], { header: true, verticalMerge: "restart" }),
      cell("ＪＶの別", w[2], { header: true, verticalMerge: "restart" }),
      cell("工事名", w[3], { header: true, verticalMerge: "restart" }),
      cell("工事現場のある都道府県及び市区町村名", w[4], { header: true, verticalMerge: "restart" }),
      cell("配置技術者", spanWidth(5, 3), { header: true, columnSpan: 3 }),
      cell("請負代金の額（千円）", spanWidth(8, 4), { header: true, columnSpan: 4 }),
      cell("工期", spanWidth(12, 2), { header: true, columnSpan: 2 }),
    ],
  });
  const bottom = new TableRow({
    tableHeader: true,
    children: [
      cell("", w[0], { header: true, verticalMerge: "continue" }),
      cell("", w[1], { header: true, verticalMerge: "continue" }),
      cell("", w[2], { header: true, verticalMerge: "continue" }),
      cell("", w[3], { header: true, verticalMerge: "continue" }),
      cell("", w[4], { header: true, verticalMerge: "continue" }),
      cell("氏名", w[5], { header: true }),
      cell("主任技術者", w[6], { header: true }),
      cell("監理技術者", w[7], { header: true }),
      cell("", w[8], { header: true }),
      cell("うち PC", w[9], { header: true }),
      cell("うち 法面処理", w[10], { header: true }),
      cell("うち 鋼橋上部", w[11], { header: true }),
      cell("着工年月", w[12], { header: true }),
      cell("完成又は完成予定年月", w[13], { header: true }),
    ],
  });
  return [top, bottom];
}

/** 空行（手書きでの追記用）。 */
const EMPTY_ROW = /** @type {Youshiki2FormRow} */ ({
  orderer: "",
  contractorType: "",
  jointVenture: "",
  projectName: "",
  siteLocation: "",
  engineerName: "",
  chiefEngineerMark: "",
  supervisingEngineerMark: "",
  amountThousandYen: "",
  startMonth: "",
  completionMonth: "",
});

/**
 * 表に出す行（足りなければ MIN_TABLE_ROWS まで空行で埋める）。
 * @param {Youshiki2FormRow[]} rows
 * @returns {Youshiki2FormRow[]}
 */
export function padRows(rows) {
  const padding = Math.max(0, MIN_TABLE_ROWS - rows.length);
  return [...rows, ...Array.from({ length: padding }, () => EMPTY_ROW)];
}

/**
 * 1行分のセル（行データ → TableRow）。
 * @param {Youshiki2FormRow} row
 */
function buildDataRow(row) {
  const w = COLUMN_WIDTHS;
  return new TableRow({
    children: [
      cell(row.orderer, w[0], { align: "left" }),
      cell(row.contractorType, w[1]),
      cell(row.jointVenture, w[2]),
      cell(row.projectName, w[3], { align: "left" }),
      cell(row.siteLocation, w[4], { align: "left" }),
      cell(row.engineerName, w[5], { align: "left" }),
      cell(row.chiefEngineerMark, w[6]),
      cell(row.supervisingEngineerMark, w[7]),
      cell(row.amountThousandYen, w[8], { align: "right" }),
      cell("", w[9]),
      cell("", w[10]),
      cell("", w[11]),
      cell(row.startMonth, w[12]),
      cell(row.completionMonth, w[13]),
    ],
  });
}

/**
 * 合計欄（合計／うち元請工事）の2行。
 * @param {Youshiki2FormSheet} sheet
 */
function buildTotalRows(sheet) {
  const w = COLUMN_WIDTHS;
  /** @param {string} label @param {string} amount */
  const row = (label, amount) =>
    new TableRow({
      children: [
        cell(label, spanWidth(0, 8), { header: true, columnSpan: 8, align: "right" }),
        cell(amount, w[8], { align: "right" }),
        cell("", w[9]),
        cell("", w[10]),
        cell("", w[11]),
        cell("", spanWidth(12, 2), { columnSpan: 2 }),
      ],
    });
  return [
    row(`合計\u3000${sheet.totalCount}件`, sheet.totalAmountThousandYen),
    row(`うち元請工事\u3000${sheet.primeCount}件`, sheet.primeAmountThousandYen),
  ];
}

/**
 * 業種1つ分の本文（様式番号・表題・業種と税込/税抜の欄・表）。
 * @param {Youshiki2FormSheet} sheet
 */
function buildSheetChildren(sheet) {
  return [
    new Paragraph({
      children: [new TextRun({ text: "様式第二号（第二条、第十九条の八、第十九条の十二関係）", font: FONT, size: 16 })],
    }),
    buildFormLayoutDisclaimerParagraph(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "工　事　経　歴　書", font: FONT, size: 28, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: `（建設工事の種類）\u3000${sheet.constructionType}\u3000\u3000\u3000（税込・税抜）`, font: FONT, size: 20 }),
      ],
    }),
    new Table({
      width: { size: spanWidth(0, COLUMN_WIDTHS.length), type: WidthType.DXA },
      columnWidths: COLUMN_WIDTHS,
      rows: [...buildHeaderRows(), ...padRows(sheet.rows).map(buildDataRow), ...buildTotalRows(sheet)],
    }),
  ];
}

/** A4横のセクション設定（docx は orientation 指定で幅と高さを入れ替える）。 */
const A4_LANDSCAPE_PROPERTIES = {
  page: {
    size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
    margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
  },
};

/** 手書きで補う欄と確認事項（最後のページにまとめる）。 */
export const YOUSHIKI2_FORM_CHECK_ITEMS = [
  "「ＪＶの別」「工事現場のある都道府県及び市区町村名」「うち PC・法面処理・鋼橋上部」は入力項目が無いため空欄です。手書きで補ってください。",
  "「税込・税抜」は該当しない方を消してください。経審に使う場合は税抜金額です（金額の換算はしていません）。",
  "請負代金の額は千円未満を切り捨てています。許可行政庁の手引きの端数処理と合っているか確認してください。",
  "正式様式の「小計」（ページごと）は出していません。業種ごとの合計のみです。",
  "掲載件数の絞り込み（経審は完工高累計のおおむね7割まで、軽微な工事の件数制限など）と完成・未成工事の区分は、提出目的に応じて行政書士が判断してください。",
];

/**
 * 工事経歴書（罫線版）の Document を組み立てる。業種ごとに1セクション（1枚目から改ページ）。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki2FormDocument(profile) {
  const sheets = resolveYoushiki2FormSheets(profile);

  const sections = sheets.map((sheet) => ({
    properties: A4_LANDSCAPE_PROPERTIES,
    children: buildSheetChildren(sheet),
  }));

  /** @type {Paragraph[]} */
  const notes = [];
  if (sheets.length === 0) {
    notes.push(buildFormLayoutDisclaimerParagraph());
    notes.push(...buildBulletList("注意", ["工事経歴が入力されていません"], { warning: true }));
  }
  notes.push(...buildBulletList("確認事項（警告）", YOUSHIKI2_FORM_CHECK_ITEMS, { warning: true }));
  sections.push({ properties: A4_LANDSCAPE_PROPERTIES, children: notes });

  return new Document({ sections });
}

/**
 * 工事経歴書（罫線版）を .docx ファイルとして書き出す。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki2FormDocx(profile, outPath) {
  await writeDocxFile(buildYoushiki2FormDocument(profile), outPath);
}
