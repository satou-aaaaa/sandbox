/**
 * 経審の受審前提条件（建設業許可の保有・決算変更届の提出状況・
 * 業種区分の選択）を確認する。
 *
 * 参照: e-Gov法令検索「建設業法」第27条の23（経営事項審査は建設業許可を
 * 前提とする公共工事の直接請負に必要な審査であることを2026年9月に原文
 * 確認済み）https://laws.e-gov.go.jp/law/324AC0000000100
 *
 * 他モジュールの要件判定関数と異なり、同一クライアントレコード内の
 * 建設業許可`LicenseEntry`の有無を確認する必要があるため、`ClientRecord`
 * 全体を第2引数として受け取る（docs/DESIGN_keiei-jiko-shinsa-core.md 4.1節）。
 *
 * @param {import('./types.js').KeieiJikoShinsaPrerequisiteInput} input
 * @param {import('../../../core/reminders/digest.js').ClientRecord} clientRecord
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKeieiJikoShinsaPrerequisite(input, clientRecord) {
  const constructionLicense = clientRecord.licenses?.find((l) => (l.licenseCategory ?? "construction") === "construction");

  if (!constructionLicense) {
    // 建設業許可が無い場合は即座に不合格とする（法定の前提条件のため、
    // 他の項目のチェックを続ける意味が無い。早期リターン）。
    return {
      key: "keieiJikoShinsaPrerequisite",
      label: "経審受審の前提条件",
      passed: false,
      reasons: [
        'このクライアントは建設業許可（licenseCategory: "construction"）を保有していません。経審は建設業許可を受けていることが前提条件です。',
      ],
      warnings: [],
    };
  }

  let passed = true;
  const reasons = [];
  if (!input.isKessanHenkoTodokeSubmitted) {
    passed = false;
    reasons.push("直近決算分の決算変更届が未提出です。経審の申請には最新の決算内容を反映した決算変更届が前提書類として必要です。");
  }
  if (!input.targetGyoshu || input.targetGyoshu.length === 0) {
    passed = false;
    reasons.push("経審を受ける業種区分が1件も選択されていません。");
  }
  if (passed) reasons.push("建設業許可の保有・決算変更届の提出・業種区分の選択、いずれも確認できました。");

  return { key: "keieiJikoShinsaPrerequisite", label: "経審受審の前提条件", passed, reasons, warnings: [] };
}
