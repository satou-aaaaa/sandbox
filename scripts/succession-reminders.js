/**
 * data/succession-cases.jsonに登録済みの相続案件について、相続放棄・
 * 相続税申告・遺留分侵害額請求の期限リマインドを表示するCLI。
 *
 * 許可のリマインド一覧（scripts/reminder-digest.js）・BtoB下請け案件の
 * 納期一覧・会社設立案件のリマインドとは別のコマンドとして扱う
 * （docs/DESIGN_souzoku-support.md 5章。強制的に1つの一覧に統合しない）。
 *
 * 【重要】ここで計算するのはあくまで期限の「見える化」である。各期限に
 * 対応する実際の手続きの代理・作成は行政書士の業務範囲外のものを含む。
 */
import { loadCases } from "../src/succession/caseStore.js";
import { buildSuccessionDeadlineAlerts } from "../src/succession/reminders/souzokuDeadlines.js";
import { formatReminderDigest } from "../src/core/reminders/digest.js";

const cases = await loadCases();

if (cases.length === 0) {
  console.log("登録済みの相続案件がありません。scripts/succession-case-add.js で追加してください。");
} else {
  const alerts = buildSuccessionDeadlineAlerts(cases);
  console.log(formatReminderDigest(alerts));
}
