/**
 * CSVファイルからクライアントを data/clients.json へ一括登録・更新するCLI。
 * 同名クライアントが既に登録済みの場合は、既存データを保持したままマージする
 * （`importClients`。#74）。CSVは許可種別ごとの詳細情報（kobutsuDetail等）を
 * 持たないため、CSVに無い項目・CSVに無い既存の許可は削除せず保持する。
 * CSVの空欄で既存の値を消すことはできない（消す場合は remove-client.js 等を使う）。
 *
 * 使い方:
 *   node scripts/import-clients-csv.js <CSVファイルパス>
 *
 * CSVの列: clientName,licenseId,licenseCategory,licenseType,grantDateIso,fiscalYearEndIso,contactEmail
 * （export-clients-csv.js が出力する形式と同じ。列の並び順は自由。1行＝1許可。
 * licenseId列が無い旧形式CSVも読み込める。M7・ADR-0008）
 */
import fs from "node:fs/promises";
import { clientsFromCsv } from "../src/core/reminders/clientCsv.js";
import { importClients } from "../src/core/reminders/clientStore.js";

const inPath = process.argv[2];

if (!inPath) {
  console.error("使い方: node scripts/import-clients-csv.js <CSVファイルパス>");
  process.exit(1);
}

const text = await fs.readFile(inPath, "utf8");
const records = clientsFromCsv(text);

const { added, updated } = await importClients(records);

console.log(`取り込みました: ${records.length}件（新規${added}件・既存更新${updated}件。${inPath}）`);
if (updated > 0) {
  console.log("既存クライアントは、CSVに無い項目（許可種別ごとの詳細情報など）を保持したまま更新しました。");
}
