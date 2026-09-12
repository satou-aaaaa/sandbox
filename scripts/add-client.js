/**
 * クライアントの許可情報を data/clients.json に登録・更新するCLI。
 * 実データを扱うため、data/ ディレクトリは .gitignore で除外している。
 *
 * 使い方:
 *   node scripts/add-client.js "<クライアント名>" <許可年月日YYYY-MM-DD> [事業年度終了日YYYY-MM-DD] [連絡先メールアドレス]
 *
 * 事業年度終了日を指定せず連絡先メールアドレスだけ指定したい場合は、
 * 3番目の引数に空文字列（""）を渡すこと（例:
 * node scripts/add-client.js "サンプル建設" 2024-04-01 "" info@example.com ）。
 */
import { upsertClient } from "../src/reminders/clientStore.js";

const [, , clientName, grantDateIso, fiscalYearEndIso, contactEmail] = process.argv;

if (!clientName || !grantDateIso) {
  console.error(
    "使い方: node scripts/add-client.js \"<クライアント名>\" <許可年月日YYYY-MM-DD> [事業年度終了日YYYY-MM-DD] [連絡先メールアドレス]"
  );
  process.exit(1);
}

/** @type {import('../src/reminders/reminderDigest.js').ClientLicenseRecord} */
const record = { clientName, grantDateIso };
if (fiscalYearEndIso) record.fiscalYearEndIso = fiscalYearEndIso;
if (contactEmail) record.contactEmail = contactEmail;

const clients = await upsertClient(record);
console.log(`登録しました: ${clientName}（登録済みクライアント数: ${clients.length}）`);
