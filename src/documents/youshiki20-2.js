/**
 * 様式第二十号の二（誓約書）の自動生成モジュール。
 *
 * 要件4「欠格要件に該当しないこと」（src/licenses/construction/eligibility/rules/kekkaku.js）の
 * 判定結果をもとに、誓約書の記載内容サマリーを docx で出力する。
 *
 * 【重要】本モジュールが確認するのは、本ツールが要件判定に用いている
 * 欠格要件10項目（2026年9月に6→10項目へ拡充。第1・2・3・5・6・7・8・9・
 * 10・14号相当）のみである。建設業法第8条の欠格要件は全14号あり、未対応の
 * 第4・11〜13号（役員・使用人・法定代理人等、申請者本人以外の複数人物の
 * 欠格状況の確認が必要な号）を含め、正式な様式第二十号の二はその全項目を
 * 確認して作成する必要がある。本サマリーはあくまで一次的な確認であり、
 * 正式な誓約書の作成・内容確認・押印は必ず行政書士本人が行うこと。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
 */
import { Document } from "docx";
import { checkKekkaku } from "../licenses/construction/eligibility/rules/kekkaku.js";
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
 * ApplicantProfile から誓約書サマリーの基本情報行と、
 * 欠格要件の判定結果（RequirementCheckResult）を解決する。
 *
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @returns {{ rows: [string, string][], check: import('../licenses/construction/eligibility/types.js').RequirementCheckResult }}
 */
export function resolveYoushiki20_2Fields(profile) {
  const check = checkKekkaku(profile.kekkaku);
  /** @type {[string, string][]} */
  const rows = [
    ["申請者名（商号又は名称）", orNotEntered(profile.applicantName)],
    ["代表者氏名", orNotEntered(profile.representativeName)],
    ["許可行政庁", orNotEntered(profile.prefecture)],
    ["申請年月日", orNotEntered(profile.applicationDate)],
    ["欠格要件（本ツール確認範囲）の判定結果", check.passed ? "○ 該当なし" : "× 該当する事由あり"],
  ];
  return { rows, check };
}

/**
 * 誓約書サマリーの Document オブジェクトを組み立てる。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki20_2Document(profile) {
  const { rows, check } = resolveYoushiki20_2Fields(profile);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("誓約書（様式第二十号の二）— 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(rows),
          ...buildBulletList("判定根拠", check.reasons),
          ...buildBulletList(
            "確認事項（警告）",
            [
              "本サマリーが確認しているのは本ツールが判定に用いる欠格要件10項目のみです。建設業法第8条の全14号については、行政書士本人が別途確認してください。",
            ],
            { warning: true }
          ),
        ],
      },
    ],
  });
}

/**
 * 誓約書サマリーを .docx ファイルとして書き出す。
 * @param {import('../licenses/construction/eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki20_2Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki20_2Document(profile), outPath);
}
