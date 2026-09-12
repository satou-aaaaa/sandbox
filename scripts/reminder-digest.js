/**
 * data/clients.json に登録済みの実クライアントについて、
 * リマインド・ダイジェストを表示するCLI。
 *
 * ダミーデータでの動作確認は generate-reminder-digest-sample.js を使うこと。
 * 実クライアントの登録・削除は scripts/add-client.js / remove-client.js を使う。
 */
import { loadClients } from "../src/reminders/clientStore.js";
import { buildReminderDigest, formatReminderDigest } from "../src/reminders/reminderDigest.js";

const clients = await loadClients();

if (clients.length === 0) {
  console.log("登録済みのクライアントがありません。scripts/add-client.js で追加してください。");
} else {
  console.log(formatReminderDigest(buildReminderDigest(clients)));
}
