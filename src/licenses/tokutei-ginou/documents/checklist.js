/**
 * 特定産業分野別 添付書類チェックリスト（FR-T3.3）。
 *
 * 【重要な検証状況】全分野共通の基本書類は出入国在留管理庁公式サイトで
 * 概要を確認済みだが、分野ごとの追加書類の詳細な一覧は分野所管省庁の
 * 公表資料に定められており、本フェーズではその詳細本文までは検証
 * できていない。そのため以下のリストは一般に公表されている概要に基づく
 * 参考情報に留め、必ず出入国在留管理庁・分野所管省庁公式サイトの最新
 * 資料で確認すること（gijinkoku-coreのchecklist.jsと同じ設計判断）。
 */
import { Document } from "docx";
import { A4_PAGE_PROPERTIES, buildTitleHeading, buildDisclaimerParagraph, buildBulletList, writeDocxFile } from "../../../core/documents/common.js";
import { getField } from "../eligibility/fieldRegistry.js";

/** 全分野共通の基本添付書類（概要。必ず最新の公式資料で確認すること）。 */
const COMMON_DOCUMENTS = [
  "特定技能雇用契約書の写し",
  "雇用条件書の写し",
  "特定技能所属機関の概要を明らかにする資料",
  "技能水準・日本語能力水準を証する書類（技能評価試験合格証、日本語試験合格証、または技能実習2号関係書類）",
  "1号特定技能外国人支援計画書",
];

const VERIFICATION_WARNING =
  "この一覧は一般に公表されている概要に基づく参考情報です。出入国在留管理庁・分野所管省庁公式サイトの" +
  "最新の提出書類一覧で、申請直前に必ず内容を再確認してください。";

/**
 * @param {string} fieldKey
 * @returns {string[]}
 */
export function resolveChecklistDocuments(fieldKey) {
  const field = getField(fieldKey);
  const documents = [...COMMON_DOCUMENTS];
  if (field?.requiresSectorSpecificJapaneseTest) {
    documents.push(`分野固有の日本語試験の合格を証する書類（${field.fieldLabel}分野）`);
  }
  if (field?.supplementaryNote) {
    documents.push(`分野固有の追加書類（参考: ${field.supplementaryNote}）`);
  }
  return documents;
}

/**
 * @param {string} fieldKey
 * @returns {Document}
 */
export function buildChecklistDocument(fieldKey) {
  const field = getField(fieldKey);
  const documents = resolveChecklistDocuments(fieldKey);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`特定産業分野別 添付書類チェックリスト${field ? `（${field.fieldLabel}分野）` : ""}`),
          buildDisclaimerParagraph(),
          ...buildBulletList("重要な注意事項", [VERIFICATION_WARNING], { warning: true }),
          ...(field
            ? buildBulletList("必要な添付書類（参考）", documents)
            : buildBulletList("確認事項", ["特定産業分野が未確定のため、書類一覧を表示できません"], { warning: true })),
        ],
      },
    ],
  });
}

/**
 * @param {string} fieldKey
 * @param {string} outPath
 */
export async function writeChecklistDocx(fieldKey, outPath) {
  await writeDocxFile(buildChecklistDocument(fieldKey), outPath);
}
