/**
 * JWセンター（日本産業廃棄物処理振興センター）講習修了証の有効性
 * （発行日から5年以内）を判定する。
 *
 * 参照: 愛知県「産業廃棄物処理業許可申請に添付する修了証の取扱いについて」
 * https://www.pref.aichi.jp/soshiki/junkan/0000059102.html
 *
 * @param {import('./types.js').KoushuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKoushu(input) {
  const expiry = addYearsIso(input.completionDateIso, 5);
  const passed = input.plannedApplicationDateIso <= expiry; // ISO文字列は辞書順比較で日付比較可能
  const reasons = passed
    ? [`講習修了証は${expiry}まで有効です（申請予定日: ${input.plannedApplicationDateIso}）`]
    : [`講習修了証の有効期限（${expiry}）が申請予定日（${input.plannedApplicationDateIso}）より前です。再受講が必要です`];
  return { key: "koushu", label: "講習修了要件", passed, reasons, warnings: [] };
}

/** @param {string} iso @param {number} years */
function addYearsIso(iso, years) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
