/**
 * data/clients.json に登録済みの実クライアントについて、
 * リマインド・ダイジェストを表示するCLI。
 *
 * ダミーデータでの動作確認は generate-reminder-digest-sample.js を使うこと。
 * 実クライアントの登録・削除は scripts/add-client.js / remove-client.js を使う。
 */
import { loadClients } from "../src/reminders/clientStore.js";
import { buildReminderDigest, filterDueAlerts, formatReminderDigest, buildReminderMailtoUrl } from "../src/core/reminders/digest.js";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";

registerConstructionLicense();

const clients = await loadClients();

if (clients.length === 0) {
  console.log("登録済みのクライアントがありません。scripts/add-client.js で追加してください。");
} else {
  const alerts = buildReminderDigest(clients);
  console.log(formatReminderDigest(alerts));

  const mailtoLinks = filterDueAlerts(alerts)
    .map((alert) => ({ alert, mailtoUrl: buildReminderMailtoUrl(alert) }))
    .filter((item) => item.mailtoUrl);

  if (mailtoLinks.length > 0) {
    console.log("\n# メール下書きリンク（連絡先登録済みのもののみ。クリック/コピーして開いてください）\n");
    for (const { alert, mailtoUrl } of mailtoLinks) {
      console.log(`- [${alert.clientName}] ${alert.label}: ${mailtoUrl}`);
    }
  }
}
