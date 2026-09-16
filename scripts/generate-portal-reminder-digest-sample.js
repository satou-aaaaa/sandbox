import { buildCaseDeadlineAlerts } from "../src/portal/reminders/caseDeadlines.js";
import { formatReminderDigest } from "../src/core/reminders/digest.js";
import { buildSamplePartner, buildSampleCase } from "./samplePortalData.js";

/** @type {import('../src/portal/types.js').PartnerRecord[]} */
const samplePartners = [buildSamplePartner()];

/** @type {import('../src/portal/types.js').CaseRecord[]} */
const sampleCases = [
  buildSampleCase(),
  {
    caseId: "case-002",
    partnerId: "sample-law-office",
    caseName: "△△様 古物商許可申請 書類作成",
    licenseCategory: "kobutsu",
    receivedDateIso: "2026-08-20",
    dueDateIso: "2026-09-05",
    feeAmount: 50000,
    status: "納品待ち",
  },
];

const alerts = buildCaseDeadlineAlerts(sampleCases, samplePartners);
console.log(formatReminderDigest(alerts));
