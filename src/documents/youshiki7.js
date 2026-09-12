/**
 * 様式第七号（経営業務管理責任者証明書）の自動生成モジュール。
 *
 * 要件1「経営業務の管理を適正に行う体制」（src/eligibility/rules/keieiGyomuKanri.js）の
 * 判定結果を、証明を受ける者の情報とあわせて確認用サマリーとして docx で出力する。
 * 判定ロジック自体は再実装せず、既存の checkKeieiGyomuKanri を再利用することで、
 * 要件判定エンジンと様式サマリーの判定結果が食い違わないようにしている。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
 */
import { Document } from "docx";
import { checkKeieiGyomuKanri } from "../eligibility/rules/keieiGyomuKanri.js";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "./common.js";

/**
 * ApplicantProfile から様式第七号サマリーの基本情報行と、
 * 判定結果（RequirementCheckResult）を解決する。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {{ rows: [string, string][], check: import('../eligibility/types.js').RequirementCheckResult }}
 */
export function resolveYoushiki7Fields(profile) {
  const check = checkKeieiGyomuKanri(profile.keieiGyomuKanri);
  /** @type {[string, string][]} */
  const rows = [
    ["商号又は名称", orNotEntered(profile.applicantName)],
    ["許可行政庁", orNotEntered(profile.prefecture)],
    ["証明を受ける者の氏名", orNotEntered(profile.keieiGyomuKanri?.responsibleName)],
    ["地位又は役名", orNotEntered(profile.keieiGyomuKanri?.responsibleTitle)],
    ["経営業務管理体制の判定結果", check.passed ? "○ 要件を満たすと判定" : "× 要件を満たさないと判定"],
  ];
  return { rows, check };
}

/**
 * 経営業務管理責任者証明書サマリーの Document オブジェクトを組み立てる。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki7Document(profile) {
  const { rows, check } = resolveYoushiki7Fields(profile);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("経営業務管理責任者証明書（様式第七号）— 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(rows),
          ...buildBulletList("判定根拠", check.reasons),
          ...buildBulletList("確認事項（警告）", check.warnings, { warning: true }),
        ],
      },
    ],
  });
}

/**
 * 経営業務管理責任者証明書サマリーを .docx ファイルとして書き出す。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki7Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki7Document(profile), outPath);
}
