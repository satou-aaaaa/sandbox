/**
 * 期限リマインドの日次点検（スケジュール実行向け）。
 *
 * data/clients.json のクライアントについてリマインドを計算し、
 *   - 全文（クライアント名つき）は out/reminders-YYYY-MM-DD.txt にだけ保存する（ローカルのみ・Git管理外）
 *   - 標準出力には、件数と最短期限だけを出す（クライアント名は出さない）
 * ため、通知やスケジュールタスクの要約にそのまま載せても個人情報が外へ出ない（ADR-0018）。
 * メール自動送信はしない（ADR-0004）。詳細は `npm run reminders` か、保存された全文を見る。
 *
 * 使い方: npm run reminders:daily
 * 終了コード: 常に 0（期限超過があっても失敗にはしない。要約の1行目で判断する）
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadClients } from "../src/core/reminders/clientStore.js";
import { buildReminderDigest, formatReminderDigest } from "../src/core/reminders/digest.js";
import { summarizeAlertsForNotification } from "../src/core/reminders/dailySummary.js";
import { registerAllLicenses } from "../src/licenses/registerAll.js";

registerAllLicenses();

const clients = await loadClients();
if (clients.length === 0) {
  console.log("登録済みのクライアントがありません（data/clients.json）。");
} else {
  const alerts = buildReminderDigest(clients);
  const summary = summarizeAlertsForNotification(alerts);
  const today = new Date().toISOString().slice(0, 10);
  const outDir = "out";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `reminders-${today}.txt`);
  writeFileSync(outPath, `${formatReminderDigest(alerts)}\n`);
  console.log(`リマインド日次点検（${today}）: ${summary.line}`);
  console.log(`全文（クライアント名つき・ローカルのみ）: ${outPath}`);
}
