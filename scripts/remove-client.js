/**
 * data/clients.json からクライアントを1件削除するCLI（案件完了時などに使用）。
 *
 * 使い方:
 *   node scripts/remove-client.js "<クライアント名>"
 */
import { removeClient } from "../src/core/reminders/clientStore.js";

const [, , clientName] = process.argv;

if (!clientName) {
  console.error('使い方: node scripts/remove-client.js "<クライアント名>"');
  process.exit(1);
}

const clients = await removeClient(clientName);
console.log(`削除しました: ${clientName}（残りのクライアント数: ${clients.length}）`);
