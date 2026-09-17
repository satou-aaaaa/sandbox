/**
 * 4ヘクタール超の農地転用に必要となる、農林水産大臣への事前協議の要否を
 * 案内する。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】農地法附則2項（「農林水産大臣に
 * 対する協議」。当分の間の経過措置）1号・3号により、都道府県知事等は、
 * 同一の事業の目的に供するため4ヘクタールを超える農地を転用する場合、
 * 第4条第1項の許可（自己転用）・第5条第1項の許可（権利移動を伴う転用）の
 * いずれについても、許可をする前にあらかじめ農林水産大臣に協議しなければ
 * ならない。この協議の要否自体は自己申告の面積からの単純な閾値判定であり
 * 機械的に確定できるが、協議の結果（許可が下りるかどうか）は本ツールの
 * 対象外であるため、合否には影響させず、審査の長期化を見込むべき旨の
 * 警告としてのみ扱う。
 */
const DAIJIN_KYOGI_THRESHOLD_SQM = 40_000; // 4ヘクタール = 40,000平方メートル

/**
 * @param {number} [landAreaSqm] 転用対象農地の面積（平方メートル）
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkDaijinKyogiRequirement(landAreaSqm) {
  const warnings = [];
  const requiresKyogi = typeof landAreaSqm === "number" && landAreaSqm > DAIJIN_KYOGI_THRESHOLD_SQM;

  if (requiresKyogi) {
    warnings.push(
      "転用面積が4ヘクタールを超えています（農地法附則2項1号・3号）。" +
        "都道府県知事等が許可をする前に、あらかじめ農林水産大臣への協議が" +
        "必要となるため、標準処理期間より審査が長期化する見込みです。"
    );
  }

  return {
    key: "daijinKyogi",
    label: "農林水産大臣への協議の要否（4ヘクタール超案件）",
    passed: true,
    reasons: [
      requiresKyogi
        ? "転用面積が4ヘクタールを超えるため、農林水産大臣への協議が必要です"
        : "転用面積は4ヘクタール以下のため、農林水産大臣への協議は不要です",
    ],
    warnings,
  };
}
