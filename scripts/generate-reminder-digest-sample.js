import { buildReminderDigest, formatReminderDigest } from "../src/reminders/reminderDigest.js";

/**
 * 複数クライアントのダミー許可情報。実在の顧客データは絶対に使用しない（NFR-5）。
 * @type {import('../src/reminders/reminderDigest.js').ClientLicenseRecord[]}
 */
const sampleClients = [
  { clientName: "サンプル建設株式会社", grantDateIso: "2021-10-21", fiscalYearEndIso: "2026-08-31" },
  { clientName: "テスト工業有限会社", grantDateIso: "2020-04-01" },
  { clientName: "ダミー電気工事店", grantDateIso: "2024-04-01", fiscalYearEndIso: "2026-03-31" },
];

const alerts = buildReminderDigest(sampleClients);
console.log(formatReminderDigest(alerts));
