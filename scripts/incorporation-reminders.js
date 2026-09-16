/**
 * data/incorporation-cases.jsonに登録済みの会社設立サポート案件について、
 * 定款認証予約日・出資金払込期限のリマインドを表示するCLI。
 *
 * 許可のリマインド一覧（scripts/reminder-digest.js）・BtoB下請け案件の
 * 納期一覧（scripts/portal-case-reminders.js）とは別のコマンドとして扱う
 * （docs/DESIGN_kaisha-secchi-support.md 5章。両者を1つの一覧に強制統合しない）。
 *
 * ダミーデータでの動作確認は generate-incorporation-reminder-digest-sample.js を使うこと。
 */
import { loadCases } from "../src/incorporation/caseStore.js";
import { buildIncorporationScheduleAlerts } from "../src/incorporation/reminders/incorporationSchedule.js";
import { formatReminderDigest } from "../src/core/reminders/digest.js";

const cases = await loadCases();

if (cases.length === 0) {
  console.log("登録済みの会社設立案件がありません。scripts/incorporation-case-add.js で追加してください。");
} else {
  const alerts = buildIncorporationScheduleAlerts(cases);
  console.log(formatReminderDigest(alerts));
}
