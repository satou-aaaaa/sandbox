/**
 * 元請行政書士（PartnerRecord）を data/partners.json に登録・更新するCLI。
 *
 * 使い方:
 *   node scripts/portal-add-partner.js "<partnerId>" "<事務所名>" [--contact-name <担当者名>] [--contact-email <連絡先メールアドレス>]
 *
 * 例:
 *   node scripts/portal-add-partner.js sample-law-office "サンプル行政書士法人" --contact-name "田中 次郎" --contact-email tanaka@example.com
 */
import { upsertPartner } from "../src/portal/caseStore.js";

const USAGE =
  '使い方: node scripts/portal-add-partner.js "<partnerId>" "<事務所名>" [--contact-name <担当者名>] [--contact-email <連絡先メールアドレス>]';

const [, , partnerId, partnerName, ...rest] = process.argv;

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

if (!partnerId || !partnerName) {
  console.error(USAGE);
  process.exit(1);
}

/** @type {import('../src/portal/types.js').PartnerRecord} */
const partner = { partnerId, partnerName };
if (options["contact-name"]) partner.contactName = options["contact-name"];
if (options["contact-email"]) partner.contactEmail = options["contact-email"];

const partners = await upsertPartner(partner);
console.log(`登録しました: ${partnerName}（partnerId: ${partnerId}、登録済み元請数: ${partners.length}）`);
