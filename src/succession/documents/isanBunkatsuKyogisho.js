/**
 * 遺産分割協議書サマリーの生成（FR-S2.2〜FR-S2.5）。
 *
 * `hasDisputeAmongHeirs`（争いの兆候フラグ）が真の案件では、協議書生成の
 * 前後で「争いがある場合の遺産分割協議書作成・交渉は行政書士の業務範囲外
 * であり、弁護士に相談する必要がある」旨の警告を強調表示する（FR-S2.5・
 * NFR-S1。1.3節の職域境界を機能レベルで担保する重要項目）。
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
} from "../../core/documents/common.js";

const SUCCESSION_DISCLAIMER_EXTRA =
  "※ 本書面は相続人全員の合意内容を整理したサマリーです。実際の提出・登記手続き等には、" +
  "相続人全員の実印による押印・印鑑証明書の添付など、別途必要な体裁を個別に確認してください。";

const DISPUTE_WARNING =
  "【重要】相続人間に争いの兆候が記録されています。争いがある場合の遺産分割協議書の" +
  "作成・交渉は行政書士の業務範囲外であり、弁護士への相談が必要です（弁護士法第72条）。" +
  "本書面の作成・使用前に必ず確認してください。";

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {[string, string][]}
 */
export function resolveIsanBunkatsuKyogishoRows(heirsResult, properties) {
  const rows = heirsResult.heirs.map(
    /** @returns {[string, string]} */
    (h) => [`法定相続人: ${orNotEntered(h.label ?? h.personId)}`, `法定相続分: ${h.shareFraction}`]
  );
  for (const p of properties) {
    rows.push([`財産: ${p.category} ${orNotEntered(p.description)}`, `取得者: ${orNotEntered(p.assignedHeirPersonId)}`]);
  }
  return rows;
}

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @param {import('../types.js').SuccessionCaseRecord} caseRecord
 * @returns {Document}
 */
export function buildIsanBunkatsuKyogishoDocument(heirsResult, properties, caseRecord) {
  /** @type {(import('docx').Paragraph | import('docx').Table)[]} */
  const children = [
    buildTitleHeading("遺産分割協議書 — 合意内容サマリー"),
    buildDisclaimerParagraph(),
    ...buildBulletList("重要な注意事項", [SUCCESSION_DISCLAIMER_EXTRA]),
  ];
  if (caseRecord.hasDisputeAmongHeirs) {
    children.push(...buildBulletList("職域範囲の確認", [DISPUTE_WARNING], { warning: true }));
  }
  children.push(buildLabeledTable(resolveIsanBunkatsuKyogishoRows(heirsResult, properties)));
  return new Document({ sections: [{ properties: A4_PAGE_PROPERTIES, children }] });
}

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @param {import('../types.js').SuccessionCaseRecord} caseRecord
 * @param {string} outPath
 */
export async function writeIsanBunkatsuKyogishoDocx(heirsResult, properties, caseRecord, outPath) {
  await writeDocxFile(buildIsanBunkatsuKyogishoDocument(heirsResult, properties, caseRecord), outPath);
}
