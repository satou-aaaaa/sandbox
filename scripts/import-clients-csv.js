/**
 * CSVファイルからクライアントを data/clients.json へ一括登録・更新するCLI。
 * 同名クライアントが既に登録済みの場合は上書きする（upsertClient と同じ挙動）。
 *
 * 使い方:
 *   node scripts/import-clients-csv.js <CSVファイルパス>
 *
 * CSVの列: clientName,grantDateIso,fiscalYearEndIso,contactEmail
 * （export-clients-csv.js が出力する形式と同じ。列の並び順は自由）
 */
import fs from "node:fs/promises";
import { clientsFromCsv } from "../src/reminders/clientCsv.js";
import { upsertClient } from "../src/reminders/clientStore.js";

const inPath = process.argv[2];

if (!inPath) {
  console.error("使い方: node scripts/import-clients-csv.js <CSVファイルパス>");
  process.exit(1);
}

const text = await fs.readFile(inPath, "utf8");
const records = clientsFromCsv(text);

for (const record of records) {
  await upsertClient(record);
}

console.log(`取り込みました: ${records.length}件（${inPath}）`);
