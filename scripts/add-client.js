/**
 * クライアントの許可情報を data/clients.json に登録・更新するCLI。
 * 実データを扱うため、data/ ディレクトリは .gitignore で除外している。
 *
 * 【M7: 複数許可対応（ADR-0008）】同じ<クライアント名>を指定して実行すると
 * 「そのクライアントへの許可の追加・更新」になる（--license-id が既存の
 * 許可と一致すればその許可を上書き、一致しなければ新しい許可として追記する。
 * 既存の他の許可はそのまま保持され、クロバーされない）。決算日・連絡先は
 * クライアント（会社）単位の情報のため、省略すると既存の値を保持する
 * （新規クライアントの場合は未設定のまま）。
 *
 * 使い方:
 *   node scripts/add-client.js "<クライアント名>" --license-id <許可ID> --grant-date <許可年月日YYYY-MM-DD> [--license-type 一般|特定] [--fiscal-year-end <事業年度終了日YYYY-MM-DD>] [--contact-email <連絡先メールアドレス>]
 *
 * 例（新規クライアント。1件目の許可を登録）:
 *   node scripts/add-client.js "サンプル建設" --license-id 般-建築工事業 --grant-date 2024-04-01 --fiscal-year-end 2026-03-31 --contact-email info@example.com
 *
 * 例（既存クライアントに2件目の許可を追加。会社単位の情報は省略すれば既存値を保持）:
 *   node scripts/add-client.js "サンプル建設" --license-id 特-とび土工工事業 --grant-date 2025-06-01 --license-type 特定
 */
import { upsertClientLicense } from "../src/core/reminders/clientStore.js";

const USAGE = [
  '使い方: node scripts/add-client.js "<クライアント名>" --license-id <許可ID> --grant-date <許可年月日YYYY-MM-DD> ' +
    "[--license-type 一般|特定] [--fiscal-year-end <事業年度終了日YYYY-MM-DD>] [--contact-email <連絡先メールアドレス>]",
  "同じ<クライアント名>を指定すると、そのクライアントへの許可の追加・更新になります",
  "（--license-idが既存の許可と一致すれば上書き、一致しなければ追記します）。",
].join("\n");

const [, , clientName, ...rest] = process.argv;

/** @type {Record<string, string>} */
const options = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i];
  const value = rest[i + 1];
  if (!key || !key.startsWith("--") || value === undefined) {
    console.error(USAGE);
    process.exit(1);
  }
  options[key.slice(2)] = value;
}

if (!clientName || !options["license-id"] || !options["grant-date"]) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {import('../src/core/reminders/digest.js').LicenseEntry} */
const license = { licenseId: options["license-id"], grantDateIso: options["grant-date"] };
if (options["license-type"]) {
  license.licenseType = /** @type {"一般" | "特定"} */ (options["license-type"]);
}

/** @type {{ fiscalYearEndIso?: string, contactEmail?: string }} */
const companyInfo = {};
if (options["fiscal-year-end"]) companyInfo.fiscalYearEndIso = options["fiscal-year-end"];
if (options["contact-email"]) companyInfo.contactEmail = options["contact-email"];

const clients = await upsertClientLicense(clientName, license, companyInfo);
const client = clients.find((c) => c.clientName === clientName);
console.log(
  `登録しました: ${clientName} / 許可ID: ${license.licenseId}` +
    `（登録済みクライアント数: ${clients.length}、${clientName}の保有許可数: ${client ? client.licenses.length : 0}）`
);
