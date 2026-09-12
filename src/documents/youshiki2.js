/**
 * 様式第二号（工事経歴書）の自動生成モジュール（M8）。
 *
 * 経営事項審査（経審）の添付書類であると同時に、決算変更届でも毎事業年度
 * 必要になる書類のため、経審対応の有無に関わらず単独で価値がある。
 * ただし、経審の評点計算（X1・X2・Y・Z・W・総合評定値P）はこのモジュールの
 * 対象外（`docs/adr/0009-keishin-scope-documents-only.md`参照）。
 *
 * 参照: 建設業法施行規則 様式第二号
 * https://laws.e-gov.go.jp/data/MinisterialOrdinance/324M50004000014/621062_1/pict/2FH00000061301.pdf
 *
 * 【意図的に自動化していないこと】
 * - 掲載件数の絞り込み（経審は完工高累計のおおむね7割まで、決算変更届等では
 *   500万円未満＜建築1500万円未満＞の軽微な工事は10件までなど、提出目的に
 *   よって選定基準が異なる）は行わない。入力されたすべての工事を並び順のみ
 *   解決して表示し、最終的な掲載件数の判断は行政書士本人に委ねる。
 * - 消費税の税込・税抜換算は行わない（経審提出時は税抜金額が必須だが、
 *   税率を本ツールが仮定して自動換算することはしない）。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildHeaderedTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "./common.js";

const TABLE_HEADERS = ["業種", "元請/下請", "注文者", "工事名", "請負代金の額", "工期", "配置技術者"];

/**
 * 請負代金の額を表示用文字列に整形する（3桁区切り＋円）。
 * @param {number} amount
 * @returns {string}
 */
function formatContractAmount(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return orNotEntered(undefined);
  return `${amount.toLocaleString("ja-JP")}円`;
}

/**
 * 工期（着手年月〜完成年月）を表示用文字列に整形する。着手年月は任意。
 * @param {import('../eligibility/types.js').WorkRecordInput} record
 * @returns {string}
 */
function formatConstructionPeriod(record) {
  const start = record.startDateIso ? record.startDateIso : "（着手年月未入力）";
  return `${start} 〜 ${orNotEntered(record.completionDateIso)}`;
}

/**
 * 配置技術者の氏名・別（主任技術者／監理技術者）を表示用文字列に整形する。
 * @param {import('../eligibility/types.js').WorkRecordInput} record
 * @returns {string}
 */
function formatEngineer(record) {
  if (!record.assignedEngineerName) return orNotEntered(undefined);
  return record.engineerRole ? `${record.assignedEngineerName}（${record.engineerRole}）` : record.assignedEngineerName;
}

/**
 * ApplicantProfile.constructionHistory から工事経歴書の表示行を解決する。
 * 正式な記載順序（元請工事を先に、各グループ内は請負代金の額の大きい順）に
 * 並べ替える。入力側（配列の並び順）には依存しない設計にすることで、
 * 入力順を気にせず追記できるようにしている。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {string[][]}
 */
export function resolveYoushiki2Rows(profile) {
  const records = profile.constructionHistory ?? [];

  const sorted = [...records].sort((a, b) => {
    if (a.isSubcontract !== b.isSubcontract) return a.isSubcontract ? 1 : -1;
    return b.contractAmount - a.contractAmount;
  });

  return sorted.map((record) => [
    orNotEntered(record.constructionType),
    record.isSubcontract ? "下請" : "元請",
    orNotEntered(record.orderer),
    orNotEntered(record.projectName),
    formatContractAmount(record.contractAmount),
    formatConstructionPeriod(record),
    formatEngineer(record),
  ]);
}

/**
 * 工事経歴書サマリーの Document オブジェクトを組み立てる。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki2Document(profile) {
  const rows = resolveYoushiki2Rows(profile);

  /** @type {(import('docx').Paragraph | import('docx').Table)[]} */
  const children = [
    buildTitleHeading("工事経歴書（様式第二号）— 記載内容サマリー"),
    buildDisclaimerParagraph(),
  ];

  if (rows.length === 0) {
    children.push(...buildBulletList("注意", ["工事経歴が入力されていません"], { warning: true }));
  } else {
    children.push(buildHeaderedTable(TABLE_HEADERS, rows));
  }

  children.push(
    ...buildBulletList(
      "確認事項（警告）",
      [
        "掲載件数の絞り込み（経審は完工高累計のおおむね7割まで、決算変更届等では軽微な工事の掲載省略等）は自動化していません。提出目的に応じて行政書士が判断してください。",
        "請負代金の額が税込・税抜のいずれであるかは入力値をそのまま表示しています。経審提出用は税抜金額であることを確認してください。",
      ],
      { warning: true }
    )
  );

  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children,
      },
    ],
  });
}

/**
 * 工事経歴書サマリーを .docx ファイルとして書き出す。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki2Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki2Document(profile), outPath);
}
