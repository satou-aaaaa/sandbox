/**
 * 住宅宿泊事業届出書の記載内容サマリー。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').MinpakuApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveTodokedeshoRows(profile) {
  return [
    ["届出者氏名（法人名）", orNotEntered(profile.applicantName)],
    ["住所", orNotEntered(profile.address)],
    ["届出住宅の所在地", orNotEntered(profile.propertyAddress)],
    ["家主居住型／家主不在型", orNotEntered(profile.residentType)],
    ["住宅宿泊管理業者", orNotEntered(profile.managementCompanyName)],
  ];
}

/**
 * @param {import('../eligibility/types.js').MinpakuApplicantProfile} profile
 * @returns {Document}
 */
export function buildTodokedeshoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("住宅宿泊事業届出書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveTodokedeshoRows(profile)),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').MinpakuApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeTodokedeshoDocx(profile, outPath) {
  await writeDocxFile(buildTodokedeshoDocument(profile), outPath);
}
