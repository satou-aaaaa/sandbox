/**
 * Y（経営状況分析）の申請状況を確認する。財務分析そのものは登録経営状況
 * 分析機関が行う法定の外部手続であり、本ツールは代行・自動計算しない
 * （docs/REQUIREMENTS_keiei-jiko-shinsa-core.md 1.3節）。
 *
 * @param {"未申請" | "申請中" | "結果受領済み"} yBunsekiStatus
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 *
 * 法令根拠（2026-09-30に e-Gov法令API v2 で条文との対応を再確認）:
 * - 建設業法 第27条の24（経営状況分析。登録経営状況分析機関が行う）: https://laws.e-gov.go.jp/law/324AC0000000100
 */
export function checkYBunsekiStatus(yBunsekiStatus) {
  const passed = yBunsekiStatus === "結果受領済み";
  const reasons = passed
    ? ["経営状況分析（Y）の結果を登録経営状況分析機関から受領済みです。"]
    : [`Y（経営状況分析）は現在「${yBunsekiStatus}」です。経営規模等評価申請にはYの分析結果が必要なため、早めに登録経営状況分析機関へ申請してください。`];
  return { key: "yBunsekiStatus", label: "経営状況分析（Y）の申請状況", passed, reasons, warnings: [] };
}
