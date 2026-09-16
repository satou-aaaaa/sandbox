/**
 * 必要書類（登記事項証明書・図面・消防法令適合通知書・誓約書 等）の
 * 充足チェックリスト（FR-M1.3・FR-M1.4）。
 *
 * 合否判定ではなく「準備状況の可視化」が目的のため、`RequirementCheckResult`
 * の `passed` は「すべての必須書類が揃っているか」の意味で使い、
 * `reasons` に未取得の書類を列挙する形にする。
 *
 * @param {import('./types.js').RequiredDocumentItem[]} documents
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkDocumentChecklist(documents) {
  const missing = documents.filter((d) => !d.obtained);
  const foreignLanguageMissingTranslation = documents.filter((d) => d.isForeignLanguage && d.obtained);
  const reasons = missing.length ? missing.map((d) => `${d.label}が未取得です`) : ["必要書類はすべて取得済みです"];
  const warnings = foreignLanguageMissingTranslation.map(
    (d) => `${d.label}は外国語発行のため、日本語訳の添付を確認してください`
  );
  return {
    key: "documentChecklist",
    label: "必要書類の充足確認",
    passed: missing.length === 0,
    reasons,
    warnings,
  };
}
