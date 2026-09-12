/**
 * 様式第八号（専任技術者証明書）の自動生成モジュール。
 *
 * 要件2「営業所ごとの専任技術者の配置」（src/eligibility/rules/senninGijutsusha.js）の
 * 判定結果を、営業所ごとに証明を受ける者の情報とあわせて確認用サマリーとして docx で出力する。
 * 判定ロジックは checkSenninGijutsushaForOffice を再利用し、独自に再実装しない。
 *
 * 【注意】正式な様式第八号は営業所ごとに1通作成するのが原則。本モジュールは
 * 確認のしやすさを優先し、全営業所分を1つのdocxにまとめて出力する
 * （正式提出時は営業所ごとに分割すること）。
 *
 * 実際の提出書類として使う前に、必ず行政書士本人が内容を確認し、
 * 国交省・都道府県が指定する正式様式に転記・整形すること。
 */
import { Document } from "docx";
import { checkSenninGijutsushaForOffice } from "../eligibility/rules/senninGijutsusha.js";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildSubHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildBulletList,
  orNotEntered,
  writeDocxFile,
} from "./common.js";

/**
 * ApplicantProfile から営業所ごとのセクション情報（基本情報行・判定結果）を解決する。
 * 営業所が1件も入力されていない場合は空配列を返す。
 *
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {{ officeName: string, rows: [string, string][], check: ReturnType<typeof checkSenninGijutsushaForOffice> }[]}
 */
export function resolveYoushiki8Sections(profile) {
  const list = profile.senninGijutsushaList ?? [];
  return list.map((office) => {
    const check = checkSenninGijutsushaForOffice(office);
    const rows = [
      ["営業所名", orNotEntered(office.officeName)],
      ["専任技術者の氏名", orNotEntered(office.personName)],
      ["許可区分", office.licenseType === "特定" ? "特定建設業" : "一般建設業"],
      ["専任技術者要件の判定結果", check.passed ? "○ 要件を満たすと判定" : "× 要件を満たさないと判定"],
    ];
    return { officeName: office.officeName, rows, check };
  });
}

/**
 * 専任技術者証明書サマリーの Document オブジェクトを組み立てる。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @returns {Document}
 */
export function buildYoushiki8Document(profile) {
  const sections = resolveYoushiki8Sections(profile);
  const children = [
    buildTitleHeading("専任技術者証明書（様式第八号）— 記載内容サマリー"),
    buildDisclaimerParagraph(),
  ];

  if (sections.length === 0) {
    children.push(...buildBulletList("注意", ["営業所・専任技術者の情報が入力されていません"], { warning: true }));
  }

  for (const section of sections) {
    children.push(buildSubHeading(`営業所: ${orNotEntered(section.officeName)}`));
    children.push(buildLabeledTable(section.rows));
    children.push(...buildBulletList("判定根拠", section.check.reasons));
    children.push(...buildBulletList("確認事項（警告）", section.check.warnings, { warning: true }));
  }

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
 * 専任技術者証明書サマリーを .docx ファイルとして書き出す。
 * @param {import('../eligibility/types.js').ApplicantProfile} profile
 * @param {string} outPath
 */
export async function writeYoushiki8Docx(profile, outPath) {
  await writeDocxFile(buildYoushiki8Document(profile), outPath);
}
