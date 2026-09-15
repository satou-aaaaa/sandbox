/**
 * 様式第六号（役員等の一覧表）の自動生成モジュール。
 *
 * youshiki1.js と同じ位置づけで、正式様式のレイアウトではなく
 * 「役員等の氏名・役名・生年月日を一覧化した確認用サマリー」を docx で出力する。
 * 入力は要件判定エンジンと同じ ApplicantProfile 型（の officers フィールド）を再利用する。
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
  orNotEntered,
  writeDocxFile,
} from "../core/documents/common.js";

/**
 * ApplicantProfile から役員一覧の表示行（役員1名につき3行のラベル・値）を解決する。
 * officers が未入力の場合は、その旨がわかる1件分のプレースホルダー行を返す。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveYoushiki6Rows(profile) {
  const officers = profile.officers ?? [];
  if (officers.length === 0) {
    return [["役員情報", "（未入力）役員等の一覧が入力されていません"]];
  }

  /** @type {[string, string][]} */
  const rows = [];
  officers.forEach((officer, index) => {
    const no = index + 1;
    rows.push([`役員 ${no} — 氏名`, orNotEntered(officer.name)]);
    rows.push([`役員 ${no} — 役名`, orNotEntered(officer.title)]);
    rows.push([`役員 ${no} — 生年月日`, orNotEntered(officer.birthDate)]);
  });
  return rows;
}

/**
 * 役員等の一覧表サマリーの Document オブジェクトを組み立てる。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki6Document(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("役員等の一覧表（様式第六号）— 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable([
            ["商号又は名称", orNotEntered(profile.applicantName)],
            ...resolveYoushiki6Rows(profile),
          ]),
        ],
      },
    ],
  });
}

/**
 * 役員等の一覧表サマリーを .docx ファイルとして書き出す。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki6Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki6Document(profile), outPath);
}
