/**
 * data/clients.json の内容をCSVファイルへ書き出すCLI。
 * 表計算ソフトでのバックアップ・一括確認を目的とする。
 *
 * 使い方:
 *   node scripts/export-clients-csv.js [出力先パス]
 *   （省略時は out/clients-export.csv。out/ は.gitignoreによりコミット対象外）
 */
import fs from "node:fs/promises";
import path from "node:path";
import { loadClients } from "../src/reminders/clientStore.js";
import { clientsToCsv } from "../src/reminders/clientCsv.js";

const outPath = process.argv[2] || "out/clients-export.csv";

const clients = await loadClients();
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, clientsToCsv(clients), "utf8");

console.log(`書き出しました: ${outPath}（${clients.length}件）`);
