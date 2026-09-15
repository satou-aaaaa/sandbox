/**
 * 様式第十六号の一部（完成工事原価報告書）の自動生成モジュール（M10）。
 *
 * 貸借対照表（様式第十五号）・損益計算書本体（様式第十六号のうち本モジュールが
 * 扱う完成工事原価報告書を除く部分）・株主資本等変動計算書（様式第十七号）・
 * 注記表（様式第十七号の二）はこのモジュールの対象外。法定の勘定科目分類
 * （国土交通大臣告示）の全体を一次資料で確認できなかったため
 * （`docs/adr/0010-financial-statements-scope-kansei-kouji-genka-only.md`参照）。
 *
 * 完成工事原価報告書は材料費・労務費（うち労務外注費）・外注費・経費
 * （うち人件費）の4区分・6項目に固定されており、勘定科目の追加は
 * 認められていない（複数の登録経営状況分析機関の公開情報で確認済み）。
 *
 * 参照: 完成工事原価報告書｜法人用｜建設業財務諸表の解説（CIIC）
 * https://www.ciac.jp/kensetuzaimu/hojin/kansei
 *
 * 【意図的に自動化していないこと】
 * - 完成工事原価の合計額は損益計算書の完成工事原価と一致する必要があるが、
 *   損益計算書自体が対象外のため、整合性チェックは行わず注記に留める。
 * - 消費税の税込・税抜は変換しない（youshiki2.jsと同じ方針）。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
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
} from "../core/documents/common.js";

/**
 * 金額（円）を表示用文字列に整形する（3桁区切り）。
 * @param {number | undefined} amount
 * @returns {string}
 */
function formatAmount(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return orNotEntered(undefined);
  return `${amount.toLocaleString("ja-JP")}円`;
}

/**
 * ApplicantProfile.completedConstructionCost から完成工事原価報告書の
 * 表示行を解決する。未入力の場合は空配列を返す。
 *
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveYoushiki16Rows(profile) {
  const cost = profile.completedConstructionCost;
  if (!cost) return [];

  const total = (cost.materialCost || 0) + (cost.laborCost || 0) + (cost.subcontractCost || 0) + (cost.expenses || 0);

  /** @type {[string, string][]} */
  const rows = [["材料費", formatAmount(cost.materialCost)], ["労務費", formatAmount(cost.laborCost)]];
  if (cost.subcontractedLaborCost !== undefined) {
    rows.push(["（うち）労務外注費", formatAmount(cost.subcontractedLaborCost)]);
  }
  rows.push(["外注費", formatAmount(cost.subcontractCost)], ["経費", formatAmount(cost.expenses)]);
  if (cost.personnelExpenses !== undefined) {
    rows.push(["（うち）人件費", formatAmount(cost.personnelExpenses)]);
  }
  rows.push(["完成工事原価（合計）", formatAmount(total)]);

  return rows;
}

/**
 * 完成工事原価報告書サマリーの Document オブジェクトを組み立てる。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki16Document(profile) {
  const rows = resolveYoushiki16Rows(profile);

  /** @type {(import('docx').Paragraph | import('docx').Table)[]} */
  const children = [
    buildTitleHeading("完成工事原価報告書（様式第十六号の一部）— 記載内容サマリー"),
    buildDisclaimerParagraph(),
  ];

  if (rows.length === 0) {
    children.push(...buildBulletList("注意", ["完成工事原価の内訳が入力されていません"], { warning: true }));
  } else {
    children.push(buildLabeledTable(rows));
  }

  children.push(
    ...buildBulletList(
      "確認事項（警告）",
      [
        "完成工事原価の合計額は、損益計算書の完成工事原価と一致させてください（本ツールは損益計算書を対象外としているため、整合性の確認は自動化していません）。",
        "材料費・労務費・外注費・経費以外の勘定科目は追加できません（記載要領で明記されています）。",
        "請負代金の額と同様、消費税の税込・税抜換算は行っていません。経審提出用は税抜金額であることを確認してください。",
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
 * 完成工事原価報告書サマリーを .docx ファイルとして書き出す。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki16Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki16Document(profile), outPath);
}
