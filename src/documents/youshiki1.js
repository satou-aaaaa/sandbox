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
 *
 * 入力は要件判定エンジンと同じ ApplicantProfile 型を再利用する（FR-2.7 対応）。
 * 全体の許可区分は zaisanKiso.licenseType を正として用いる。
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
 * ApplicantProfile から様式第一号サマリーの表示行（ラベル・値）を解決する。
 * 未入力の項目は「（未入力）」に置き換えた、表示用の最終文字列を返す。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveYoushiki1Rows(profile) {
  const licenseType = profile.zaisanKiso?.licenseType === "特定" ? "特定建設業" : "一般建設業";
  return [
    ["申請年月日", orNotEntered(profile.applicationDate)],
    ["許可行政庁", orNotEntered(profile.prefecture)],
    ["許可の種類", licenseType],
    ["商号又は名称", orNotEntered(profile.applicantName)],
    ["代表者氏名", orNotEntered(profile.representativeName)],
    ["主たる営業所の所在地", orNotEntered(profile.address)],
    ["許可を受けようとする建設業の種類", orNotEntered(profile.constructionTypes?.join("、"))],
  ];
}

/**
 * 申請内容サマリーの Document オブジェクトを組み立てる。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki1Document(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("建設業許可申請書（様式第一号）— 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveYoushiki1Rows(profile)),
        ],
      },
    ],
  });
}

/**
 * 申請内容サマリーを .docx ファイルとして書き出す。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki1Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki1Document(profile), outPath);
}
