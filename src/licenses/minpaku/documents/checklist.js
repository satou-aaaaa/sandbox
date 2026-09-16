/**
 * 必要書類チェックリスト（FR-M1.3・FR-M2.3）の出力。
 * 判定ロジックはeligibility/documentChecklist.jsのcheckDocumentChecklistを
 * そのまま再利用する。
 */
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildBulletList,
  writeDocxFile,
} from "../../../core/documents/common.js";
import { checkDocumentChecklist } from "../eligibility/documentChecklist.js";

/**
 * @param {import('../eligibility/types.js').RequiredDocumentItem[]} documents
 * @returns {{ obtainedLabels: string[], missingLabels: string[], check: import('../../../core/eligibility/types.js').RequirementCheckResult }}
 */
export function resolveChecklistFields(documents) {
  const check = checkDocumentChecklist(documents);
  const obtainedLabels = documents.filter((d) => d.obtained).map((d) => d.label);
  const missingLabels = documents.filter((d) => !d.obtained).map((d) => d.label);
  return { obtainedLabels, missingLabels, check };
}

/**
 * @param {import('../eligibility/types.js').RequiredDocumentItem[]} documents
 * @returns {Document}
 */
export function buildChecklistDocument(documents) {
  const { obtainedLabels, missingLabels, check } = resolveChecklistFields(documents);
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("必要書類チェックリスト"),
          buildDisclaimerParagraph(),
          ...buildBulletList("取得済みの書類", obtainedLabels),
          ...buildBulletList("未取得の書類", missingLabels, { warning: missingLabels.length > 0 }),
          ...buildBulletList("確認事項", check.warnings, { warning: true }),
        ],
      },
    ],
  });
}

/**
 * @param {import('../eligibility/types.js').RequiredDocumentItem[]} documents
 * @param {string} outPath
 */
export async function writeChecklistDocx(documents, outPath) {
  await writeDocxFile(buildChecklistDocument(documents), outPath);
}
