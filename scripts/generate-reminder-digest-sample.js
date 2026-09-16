import { buildReminderDigest, formatReminderDigest } from "../src/core/reminders/digest.js";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";
import { registerKobutsuLicense } from "../src/licenses/kobutsu/index.js";
import { registerSanpaiLicense } from "../src/licenses/sanpai/index.js";
import { registerMinpakuLicense } from "../src/licenses/minpaku/index.js";
import { registerGijinkokuModule } from "../src/licenses/gijinkoku/index.js";
import { registerNouchiTenyoLicense } from "../src/licenses/nouchi-tenyo/index.js";

registerConstructionLicense();
registerKobutsuLicense();
registerSanpaiLicense();
registerMinpakuLicense();
registerGijinkokuModule();
registerNouchiTenyoLicense();

/**
 * 複数クライアントのダミー許可情報。実在の顧客データは絶対に使用しない（NFR-5）。
 * 「ダミー電気工事店」は一般・特定の2許可を保有する例（M7・ADR-0008）。
 * @type {import('../src/core/reminders/digest.js').ClientRecord[]}
 */
const sampleClients = [
  {
    clientName: "サンプル建設株式会社",
    fiscalYearEndIso: "2026-08-31",
    licenses: [{ licenseId: "般-建築工事業", grantDateIso: "2021-10-21" }],
  },
  {
    clientName: "テスト工業有限会社",
    licenses: [{ licenseId: "般-とび土工工事業", grantDateIso: "2020-04-01" }],
  },
  {
    clientName: "ダミー電気工事店",
    fiscalYearEndIso: "2026-03-31",
    licenses: [
      { licenseId: "般-電気工事業", licenseType: "一般", grantDateIso: "2024-04-01" },
      { licenseId: "特-電気工事業", licenseType: "特定", grantDateIso: "2025-06-01" },
    ],
  },
];

const alerts = buildReminderDigest(sampleClients);
console.log(formatReminderDigest(alerts));
