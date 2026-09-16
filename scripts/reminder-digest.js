/**
 * data/clients.json に登録済みの実クライアントについて、
 * リマインド・ダイジェストを表示するCLI。
 *
 * ダミーデータでの動作確認は generate-reminder-digest-sample.js を使うこと。
 * 実クライアントの登録・削除は scripts/add-client.js / remove-client.js を使う。
 */
import { loadClients } from "../src/core/reminders/clientStore.js";
import { buildReminderDigest, filterDueAlerts, formatReminderDigest, buildReminderMailtoUrl } from "../src/core/reminders/digest.js";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";
import { registerKobutsuLicense } from "../src/licenses/kobutsu/index.js";
import { registerSanpaiLicense } from "../src/licenses/sanpai/index.js";
import { registerMinpakuLicense } from "../src/licenses/minpaku/index.js";

// 各許可種別アドオンをコアへ登録する。リマインドを計算する前に必ず実行する
// 必要がある（docs/DESIGN_kobutsu-core.md 5.6節）。
// 【修正】従来はregisterConstructionLicense()のみが呼ばれており、
// registerKobutsuLicense()の呼び出しが漏れていたため、data/clients.jsonに
// 古物商許可（kobutsuDetail設定済み）のクライアントを登録していても
// このCLIでは書換申請・返納期限のリマインドが一切表示されない不具合が
// あった（実データには影響しないが、機能として欠落していた）。
registerConstructionLicense();
registerKobutsuLicense();
registerSanpaiLicense();
registerMinpakuLicense();

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
