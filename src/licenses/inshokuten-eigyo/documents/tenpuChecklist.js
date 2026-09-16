/**
 * 添付書類チェックリスト・標準的な手続きの流れの案内（FR-I2.2・FR-I2.3）。
 *
 * 具体的な提出目安日数・手数料は自治体により異なるため、ここでは代表的な
 * 目安（施設完成10〜14日前を目安とした許可申請書提出等）を案内する
 * （docs/REQUIREMENTS_inshokuten-eigyo-core.md 4.2節。対象自治体の一次資料で
 * 要確認である旨も併記する）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildBulletList, writeDocxFile } from "../../../core/documents/common.js";
import { HACCP_CONTINUING_OBLIGATION_NOTICE } from "../eligibility/disclaimer.js";

const STANDARD_FLOW = [
  "① 事前相談（工事着工前に設計図面等を保健所へ持参。着工後の是正を避けるため強く推奨）",
  "② 工事着工",
  "③ 施設完成の10〜14日前を目安に許可申請書を提出（具体的な日数は自治体により異なるため保健所へ要確認）",
  "④ 実地検査（施設完成後、保健所職員が営業者立会いのもとで施設基準への適合を確認）",
  "⑤ 許可証交付",
];

/**
 * @param {import('../eligibility/types.js').ShisetsuKijunInput} shisetsu
 * @returns {string[]}
 */
export function resolveTenpuDocuments(shisetsu) {
  const documents = ["営業施設の図面", "食品衛生責任者資格を証する書類（資格者証の写し、または講習会受講修了証の写し）"];
  if (shisetsu.usesTankOrWellWater) {
    documents.push("水質検査成績書（貯水槽水・井戸水を使用するため）");
  }
  return documents;
}

/**
 * @param {import('../eligibility/types.js').ShisetsuKijunInput} shisetsu
 * @returns {Document}
 */
export function buildTenpuChecklistDocument(shisetsu) {
  const documents = resolveTenpuDocuments(shisetsu);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("飲食店営業許可 添付書類チェックリスト・手続きの流れ"),
          buildDisclaimerParagraph(),
          ...buildBulletList("必要な添付書類", documents),
          ...buildBulletList("標準的な手続きの流れ（目安）", STANDARD_FLOW),
          ...buildBulletList("重要な注意事項", [HACCP_CONTINUING_OBLIGATION_NOTICE], { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').ShisetsuKijunInput} shisetsu
 * @param {string} outPath
 */
export async function writeTenpuChecklistDocx(shisetsu, outPath) {
  await writeDocxFile(buildTenpuChecklistDocument(shisetsu), outPath);
}
