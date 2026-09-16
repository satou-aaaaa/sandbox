/**
 * 経審の必要書類チェックリスト（工事経歴書・技術職員名簿・社会保険加入
 * 証明・納税証明書 等）。民泊の`checkDocumentChecklist`と同じ「準備状況の
 * 可視化」パターンを踏襲する（docs/REQUIREMENTS_keiei-jiko-shinsa-core.md
 * FR-KJ2.3）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildBulletList, writeDocxFile } from "../../../core/documents/common.js";

/** 経審申請の一般的な必要書類一覧（参考情報）。 */
export const REQUIRED_DOCUMENTS = [
  "工事経歴書",
  "技術職員名簿",
  "社会保険加入証明書",
  "納税証明書（法人税・消費税等）",
  "直前決算の財務諸表（貸借対照表・損益計算書等）",
  "経営状況分析結果通知書（登録経営状況分析機関から受領したもの）",
];

/**
 * @returns {Document}
 */
export function buildChecklistDocument() {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("経営事項審査 必要書類チェックリスト"),
          buildDisclaimerParagraph(),
          ...buildBulletList("必要書類（参考。都道府県・許可行政庁により異なる場合があります）", REQUIRED_DOCUMENTS),
        ],
      },
    ],
  });
}

/**
 * @param {string} outPath
 */
export async function writeChecklistDocx(outPath) {
  await writeDocxFile(buildChecklistDocument(), outPath);
}
