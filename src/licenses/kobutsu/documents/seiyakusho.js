/**
 * 誓約書（個人用）の記載内容サマリー。
 * 古物営業法第4条の欠格事由に該当しない旨の誓約文言を含む。
 * 判定ロジックはeligibility/kekkaku.jsのcheckKobutsuKekkakuをそのまま再利用し、
 * 独自に再実装しない（建設業許可のyoushiki7.jsと同じ設計方針）。
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
} from "../../../core/documents/common.js";
import { checkKobutsuKekkaku } from "../eligibility/kekkaku.js";

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {{ rows: [string, string][], check: import('../../../core/eligibility/types.js').RequirementCheckResult }}
 */
export function resolveSeiyakushoFields(profile) {
  const check = checkKobutsuKekkaku(profile.kekkaku);
  /** @type {[string, string][]} */
  const rows = [
    ["申請者氏名", orNotEntered(profile.applicantName)],
    ["住所", orNotEntered(profile.address)],
    ["欠格事由（古物営業法第4条）の該当状況", check.passed ? "該当なし" : "該当あり（要確認）"],
  ];
  return { rows, check };
}

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {Document}
 */
export function buildSeiyakushoDocument(profile) {
  const { rows, check } = resolveSeiyakushoFields(profile);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("誓約書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(rows),
          ...buildBulletList("欠格事由の判定根拠", check.reasons),
          ...buildBulletList("確認事項", check.warnings, { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeSeiyakushoDocx(profile, outPath) {
  await writeDocxFile(buildSeiyakushoDocument(profile), outPath);
}
