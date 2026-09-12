/**
 * クライアントの許可情報を data/clients.json に登録・更新するCLI。
 * 実データを扱うため、data/ ディレクトリは .gitignore で除外している。
 *
 * 使い方:
 *   node scripts/add-client.js "<クライアント名>" <許可年月日YYYY-MM-DD> [事業年度終了日YYYY-MM-DD]
 */
import { upsertClient } from "../src/reminders/clientStore.js";

const [, , clientName, grantDateIso, fiscalYearEndIso] = process.argv;

if (!clientName || !grantDateIso) {
  console.error(
    "使い方: node scripts/add-client.js \"<クライアント名>\" <許可年月日YYYY-MM-DD> [事業年度終了日YYYY-MM-DD]"
  );
  process.exit(1);
}

/** @type {import('../src/reminders/reminderDigest.js').ClientLicenseRecord} */
const record = { clientName, grantDateIso };
if (fiscalYearEndIso) record.fiscalYearEndIso = fiscalYearEndIso;

const clients = await upsertClient(record);
console.log(`登録しました: ${clientName}（登録済みクライアント数: ${clients.length}）`);
