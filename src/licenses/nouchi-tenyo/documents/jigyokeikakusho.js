/**
 * 事業計画書（転用の目的・資金計画・工事計画）の記載内容サマリー。
 * 資金調達内訳をbuildHeaderedTable（工事経歴書・産廃許可の運搬車両一覧と
 * 同じヘルパー）で表形式出力する。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildHeaderedTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

const SHIKIN_TABLE_HEADERS = ["資金調達の区分", "金額", "備考"];

/**
 * @param {import('../eligibility/types.js').ShikinChotatsuItem[] | undefined} items
 * @returns {string[][]}
 */
export function resolveShikinChotatsuRows(items) {
  return (items ?? []).map((i) => [i.kubun, `${i.amountYen.toLocaleString()}円`, orNotEntered(i.note)]);
}

/**
 * @param {import('../eligibility/types.js').NouchiTenyoApplicantProfile} profile
 * @returns {Document}
 */
export function buildJigyokeikakushoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`農地転用 事業計画書 — 申請内容サマリー（農地法${profile.article}）`),
          buildDisclaimerParagraph(),
          buildLabeledTable([
            ["転用の目的", orNotEntered(profile.purposeOfConversion)],
            ["転用対象農地の所在地", orNotEntered(profile.landAddress)],
            ["転用対象農地の面積", profile.landAreaSqm != null ? `${profile.landAreaSqm}平方メートル` : "（未入力）"],
          ]),
          buildHeaderedTable(SHIKIN_TABLE_HEADERS, resolveShikinChotatsuRows(profile.shikinChotatsu)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').NouchiTenyoApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeJigyokeikakushoDocx(profile, outPath) {
  await writeDocxFile(buildJigyokeikakushoDocument(profile), outPath);
}
