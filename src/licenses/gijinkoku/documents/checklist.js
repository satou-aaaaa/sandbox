/**
 * 所属機関（受入企業）カテゴリー別の添付書類チェックリスト（FR-G2.2）。
 *
 * 【重要な検証状況】所属機関カテゴリー1〜4の区分基準自体は出入国在留管理庁
 * 公式サイトで確認済みだが（docs/REQUIREMENTS_gijinkoku-core.md FR-G2.2）、
 * カテゴリーごとの必要書類の詳細な一覧は、出入国在留管理庁が公開する
 * 提出書類チェックシート（PDF）に定められており、本フェーズでは
 * その詳細本文までは検証できていない。そのため以下のリストは一般に
 * 公表されている概要に基づく参考情報に留め、必ず出入国在留管理庁公式
 * サイトの最新チェックシートで確認すること（申請直前に必ず再確認する
 * 旨をチェックリスト出力に明記する）。
 * 参照: https://www.moj.go.jp/isa/applications/status/gijinkoku.html
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildBulletList, writeDocxFile } from "../../../core/documents/common.js";

/** カテゴリーごとの参考添付書類一覧（概要。必ず最新の公式チェックシートで確認すること）。 */
const CATEGORY_DOCUMENTS = {
  1: ["四季報の写し、または主要取引先・取引金融機関等を記載した書類"],
  2: ["前年分の給与所得の源泉徴収税額等の法定調書合計表の写し"],
  3: [
    "前年分の給与所得の源泉徴収税額等の法定調書合計表の写し",
    "直近年度の決算文書の写し",
    "事業内容を明らかにする資料（会社案内・パンフレット等）",
  ],
  4: [
    "直近年度の決算文書の写し",
    "事業内容を明らかにする資料（会社案内・パンフレット等）",
    "その他、出入国在留管理局が必要と認める資料",
  ],
};

const VERIFICATION_WARNING =
  "この一覧は一般に公表されている概要に基づく参考情報です。出入国在留管理庁公式サイトの" +
  "最新の提出書類チェックシートで、申請直前に必ず内容を再確認してください。";

/**
 * @param {1 | 2 | 3 | 4 | undefined} companyCategory
 * @returns {string[]}
 */
export function resolveChecklistDocuments(companyCategory) {
  if (!companyCategory) return [];
  return CATEGORY_DOCUMENTS[companyCategory] ?? [];
}

/**
 * @param {1 | 2 | 3 | 4 | undefined} companyCategory
 * @returns {Document}
 */
export function buildChecklistDocument(companyCategory) {
  const documents = resolveChecklistDocuments(companyCategory);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`所属機関カテゴリー別 添付書類チェックリスト${companyCategory ? `（カテゴリー${companyCategory}）` : ""}`),
          buildDisclaimerParagraph(),
          ...buildBulletList("重要な注意事項", [VERIFICATION_WARNING], { warning: true }),
          ...(companyCategory
            ? buildBulletList("必要な添付書類（参考）", documents)
            : buildBulletList("確認事項", ["所属機関カテゴリーが未確定のため、書類一覧を表示できません"], { warning: true })),
        ],
      },
    ],
  });
}

/**
 * @param {1 | 2 | 3 | 4 | undefined} companyCategory
 * @param {string} outPath
 */
export async function writeChecklistDocx(companyCategory, outPath) {
  await writeDocxFile(buildChecklistDocument(companyCategory), outPath);
}
