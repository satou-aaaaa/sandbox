/**
 * 誓約書（欠格事由に該当しない旨）の記載内容サマリー。
 * 判定ロジックはeligibility/kekkaku.jsのcheckMinpakuKekkakuをそのまま再利用し、
 * 独自に再実装しない（古物商許可のseiyakusho.jsと同じ設計方針）。
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
import { checkMinpakuKekkaku } from "../eligibility/kekkaku.js";

/**
 * @param {import('../eligibility/types.js').MinpakuApplicantProfile} profile
 * @returns {{ rows: [string, string][], check: import('../../../core/eligibility/types.js').RequirementCheckResult }}
 */
export function resolveSeiyakushoFields(profile) {
  const check = checkMinpakuKekkaku(profile.kekkaku);
  /** @type {[string, string][]} */
  const rows = [
    ["届出者氏名", orNotEntered(profile.applicantName)],
    ["住所", orNotEntered(profile.address)],
    ["欠格事由（住宅宿泊事業法第4条）の該当状況", check.passed ? "該当なし" : "該当あり（要確認）"],
  ];
  return { rows, check };
}

/**
 * @param {import('../eligibility/types.js').MinpakuApplicantProfile} profile
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
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').MinpakuApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeSeiyakushoDocx(profile, outPath) {
  await writeDocxFile(buildSeiyakushoDocument(profile), outPath);
}
