/**
 * data/cases.json・data/partners.jsonに登録済みの案件について、
 * 納期リマインドを表示するCLI。
 *
 * 許可のリマインド一覧（scripts/reminder-digest.js）とは別のコマンドとして
 * 扱う（docs/DESIGN_uketsuke-portal.md 5章。両者を1つの一覧に強制統合しない）。
 *
 * ダミーデータでの動作確認は generate-portal-reminder-digest-sample.js を使うこと。
 */
import { loadCases, loadPartners } from "../src/portal/caseStore.js";
import { buildCaseDeadlineAlerts } from "../src/portal/reminders/caseDeadlines.js";
import { formatReminderDigest } from "../src/core/reminders/digest.js";

const [cases, partners] = await Promise.all([loadCases(), loadPartners()]);

if (cases.length === 0) {
  console.log("登録済みの案件がありません。scripts/portal-add-case.js で追加してください。");
} else {
  const alerts = buildCaseDeadlineAlerts(cases, partners);
  console.log(formatReminderDigest(alerts));
}
