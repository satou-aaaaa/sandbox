/**
 * 立地基準（転用対象農地の区分に応じた許可可否の原則）を判定する。
 *
 * 参照: e-Gov法令検索「農地法」第4条・第5条（許可制の対象となる農地転用の
 * 範囲を2026年9月に原文確認済み）https://laws.e-gov.go.jp/law/327AC0000000229
 *
 * 【重要】区分の最終認定・例外規定の該当可否は農業委員会・都道府県の
 * 審査で決まるものであり、本関数はあくまで自己申告に基づく形式的な
 * 一次判定である。この前提を warnings から絶対に外さないこと（NFR-N1）。
 *
 * @param {import('./types.js').NouchiTenyoRicchiKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkRicchiKijun(input) {
  const reasons = [];
  const warnings = [];
  /** @type {boolean} */
  let passed;

  switch (input.nouchiKubun) {
    case "第3種農地":
      passed = true;
      reasons.push("第3種農地は原則許可の対象です");
      break;

    case "第2種農地":
      passed = !!input.hasNoAlternativeLand;
      reasons.push(
        passed
          ? "第2種農地であり、周辺に代替可能な土地が無いため許可の対象となり得ます"
          : "第2種農地です。周辺に代替可能な土地がある場合は原則不許可となります"
      );
      warnings.push("代替地の有無の認定は農業委員会・都道府県の審査に委ねられます。本判定は自己申告に基づく形式的な一次判定です");
      break;

    case "農用地区域内農地":
    case "甲種農地":
    case "第1種農地":
    default:
      passed = !!input.hasExceptionReason;
      reasons.push(
        passed
          ? `${input.nouchiKubun}は原則不許可ですが、申告された例外事由（${input.exceptionReasonNote ?? "詳細未記入"}）に該当する可能性があります`
          : `${input.nouchiKubun}は原則不許可です（農用地区域内農地の場合は転用許可の前に農振除外の手続が別途必要です）`
      );
      warnings.push("農地区分の最終認定・例外規定への該当可否は農業委員会・都道府県の審査で決まります。必ず事前相談で確認してください");
      break;
  }

  return { key: "ricchiKijun", label: "立地基準（農地区分に基づく許可の可否）", passed, reasons, warnings };
}
