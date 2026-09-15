/**
 * 要件5: 誠実性
 *
 * 「請負契約の締結・履行に関して不正または不誠実な行為をするおそれが
 * 明らかでないこと」という、定量的には判定しづらい要件。
 * このモジュールは自己申告ベースのフラグを受け取り、機械的に自動合格とはせず、
 * 必ず行政書士本人の確認を促す warning を付ける設計にしている。
 *
 * 参照: 国土交通省「建設産業・不動産業：許可の要件」
 * https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000082.html
 *
 * @param {import('../types.js').SeijitsuseiInput} input
 * @returns {import('../types.js').RequirementCheckResult}
 */
export function checkSeijitsusei(input) {
  const passed = !!input.hasNoDishonestActRisk;
  const reasons = passed
    ? ["自己申告上、不正・不誠実な行為をするおそれがある事実は確認されていません"]
    : ["自己申告で、不正・不誠実な行為のおそれに関する懸念が申告されています"];

  if (input.notes) {
    reasons.push(`申告メモ: ${input.notes}`);
  }

  return {
    key: "seijitsusei",
    label: "誠実性",
    passed,
    reasons,
    warnings: [
      "誠実性は定量判定できない要件のため、本ツールの結果を鵜呑みにせず、行政書士本人が過去の営業実態・関連資格の処分歴等を個別に確認してください",
    ],
  };
}
