import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaseDeadlineAlerts } from "../src/portal/reminders/caseDeadlines.js";

/** @type {import('../src/portal/types.js').PartnerRecord[]} */
const partners = [
  { partnerId: "office-a", partnerName: "A事務所", contactEmail: "a@example.com" },
  { partnerId: "office-b", partnerName: "B事務所" },
];

test("buildCaseDeadlineAlerts: 完了済みの案件は除外される", () => {
  /** @type {import('../src/portal/types.js').CaseRecord[]} */
  const cases = [
    { caseId: "c1", partnerId: "office-a", caseName: "案件1", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-20", feeAmount: 1000, status: "完了" },
    { caseId: "c2", partnerId: "office-a", caseName: "案件2", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-25", feeAmount: 1000, status: "作業中" },
  ];
  const alerts = buildCaseDeadlineAlerts(cases, partners, "2026-09-16");
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0].clientName.includes("案件2"));
});

test("buildCaseDeadlineAlerts: 納期超過の案件はisOverdue=trueになる", () => {
  /** @type {import('../src/portal/types.js').CaseRecord[]} */
  const cases = [
    { caseId: "c1", partnerId: "office-a", caseName: "案件1", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-01", feeAmount: 1000, status: "作業中" },
  ];
  const alerts = buildCaseDeadlineAlerts(cases, partners, "2026-09-16");
  assert.equal(alerts[0].isOverdue, true);
  assert.ok(alerts[0].daysUntil < 0);
});

test("buildCaseDeadlineAlerts: partnerIdが一致する元請の名前・連絡先のみが紐づく（他のpartnerと混同しない）", () => {
  /** @type {import('../src/portal/types.js').CaseRecord[]} */
  const cases = [
    { caseId: "c1", partnerId: "office-a", caseName: "案件1", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-20", feeAmount: 1000, status: "受付" },
    { caseId: "c2", partnerId: "office-b", caseName: "案件2", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-21", feeAmount: 1000, status: "受付" },
  ];
  const alerts = buildCaseDeadlineAlerts(cases, partners, "2026-09-16");
  const alert1 = alerts.find((a) => a.clientName.includes("案件1"));
  const alert2 = alerts.find((a) => a.clientName.includes("案件2"));
  assert.ok(alert1.clientName.includes("A事務所"));
  assert.equal(alert1.contactEmail, "a@example.com");
  assert.ok(alert2.clientName.includes("B事務所"));
  assert.equal(alert2.contactEmail, undefined);
});

test("buildCaseDeadlineAlerts: 該当するpartnerが存在しない場合は「(元請不明)」と表示される", () => {
  /** @type {import('../src/portal/types.js').CaseRecord[]} */
  const cases = [
    { caseId: "c1", partnerId: "no-such-partner", caseName: "案件1", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-20", feeAmount: 1000, status: "受付" },
  ];
  const alerts = buildCaseDeadlineAlerts(cases, partners, "2026-09-16");
  assert.ok(alerts[0].clientName.includes("(元請不明)"));
});

test("buildCaseDeadlineAlerts: 納期の近い順（daysUntil昇順）にソートされる", () => {
  /** @type {import('../src/portal/types.js').CaseRecord[]} */
  const cases = [
    { caseId: "c1", partnerId: "office-a", caseName: "遠い納期", receivedDateIso: "2026-01-01", dueDateIso: "2026-12-01", feeAmount: 1000, status: "受付" },
    { caseId: "c2", partnerId: "office-a", caseName: "近い納期", receivedDateIso: "2026-01-01", dueDateIso: "2026-09-20", feeAmount: 1000, status: "受付" },
  ];
  const alerts = buildCaseDeadlineAlerts(cases, partners, "2026-09-16");
  assert.ok(alerts[0].clientName.includes("近い納期"));
  assert.ok(alerts[1].clientName.includes("遠い納期"));
});
