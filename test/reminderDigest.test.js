import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReminderDigest,
  filterDueAlerts,
  formatReminderDigest,
  buildReminderMailtoUrl,
} from "../src/reminders/reminderDigest.js";

test("buildReminderDigest: 許可日から更新準備・最終締切の2件を計算する（決算変更届の指定なし）", () => {
  const alerts = buildReminderDigest([{ clientName: "テスト建設", grantDateIso: "2024-04-01" }], "2026-09-01");
  assert.equal(alerts.length, 2);
  assert.ok(alerts.every((a) => a.clientName === "テスト建設"));
  assert.ok(alerts.some((a) => a.type === "renewal-prepare" && a.dueDateIso === "2029-01-30"));
  assert.ok(alerts.some((a) => a.type === "renewal-deadline" && a.dueDateIso === "2029-03-01"));
});

test("buildReminderDigest: fiscalYearEndIsoを指定すると決算変更届のリマインドも含まれる", () => {
  const alerts = buildReminderDigest(
    [{ clientName: "テスト建設", grantDateIso: "2024-04-01", fiscalYearEndIso: "2026-03-31" }],
    "2026-09-01"
  );
  assert.equal(alerts.length, 3);
  const kessan = alerts.find((a) => a.type === "kessan-henko");
  assert.equal(kessan.dueDateIso, "2026-07-31");
});

test("buildReminderDigest: 期限超過はisOverdue=trueかつdaysUntilが負になる", () => {
  const alerts = buildReminderDigest([{ clientName: "テスト建設", grantDateIso: "2019-04-01" }], "2026-09-01");
  const deadline = alerts.find((a) => a.type === "renewal-deadline");
  assert.equal(deadline.isOverdue, true);
  assert.ok(deadline.daysUntil < 0);
});

test("buildReminderDigest: 複数クライアントを期限が近い順（daysUntil昇順）にソートする", () => {
  const alerts = buildReminderDigest(
    [
      { clientName: "A社", grantDateIso: "2024-04-01" }, // 満了2029-03-31
      { clientName: "B社", grantDateIso: "2020-04-01" }, // 満了2025-03-31（すでに期限超過）
    ],
    "2026-09-01"
  );
  for (let i = 1; i < alerts.length; i++) {
    assert.ok(alerts[i - 1].daysUntil <= alerts[i].daysUntil);
  }
  assert.equal(alerts[0].clientName, "B社"); // 最も期限が近い（超過している）のが先頭
});

test("filterDueAlerts: デフォルト30日以内（期限超過含む）に絞り込む", () => {
  const alerts = [
    { clientName: "X", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: -5, isOverdue: true },
    { clientName: "Y", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: 10, isOverdue: false },
    { clientName: "Z", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: 90, isOverdue: false },
  ];
  const due = filterDueAlerts(alerts);
  assert.deepEqual(
    due.map((a) => a.clientName),
    ["X", "Y"]
  );
});

test("filterDueAlerts: withinDaysを指定して閾値を変更できる", () => {
  const alerts = [{ clientName: "Z", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: 90, isOverdue: false }];
  assert.equal(filterDueAlerts(alerts, { withinDays: 90 }).length, 1);
  assert.equal(filterDueAlerts(alerts, { withinDays: 89 }).length, 0);
});

test("formatReminderDigest: 空配列の場合はその旨のメッセージを返す", () => {
  const report = formatReminderDigest([]);
  assert.match(report, /対象のリマインドはありません/);
});

test("formatReminderDigest: 期限超過・30日以内・今後の予定の3区分に分けて出力する", () => {
  const alerts = buildReminderDigest(
    [
      { clientName: "期限切れ社", grantDateIso: "2020-04-01" },
      { clientName: "まもなく社", grantDateIso: "2026-10-15" },
      { clientName: "余裕社", grantDateIso: "2030-01-01" },
    ],
    "2026-09-01"
  );
  const report = formatReminderDigest(alerts);
  assert.match(report, /期限超過（至急確認してください）/);
  assert.match(report, /期限切れ社/);
  assert.match(report, /今後の予定（31日以降）/);
  assert.match(report, /余裕社/);
});

test("buildReminderDigest: contactEmailを指定するとアラートにも引き継がれる", () => {
  const alerts = buildReminderDigest(
    [{ clientName: "テスト建設", grantDateIso: "2024-04-01", contactEmail: "info@example.com" }],
    "2026-09-01"
  );
  assert.ok(alerts.every((a) => a.contactEmail === "info@example.com"));
});

test("buildReminderMailtoUrl: contactEmailが無ければnullを返す", () => {
  const [alert] = buildReminderDigest([{ clientName: "テスト建設", grantDateIso: "2024-04-01" }], "2026-09-01");
  assert.equal(buildReminderMailtoUrl(alert), null);
});

test("buildReminderMailtoUrl: contactEmailがあればmailto:リンクを返す", () => {
  const [alert] = buildReminderDigest(
    [{ clientName: "テスト建設", grantDateIso: "2024-04-01", contactEmail: "info@example.com" }],
    "2026-09-01"
  );
  const url = buildReminderMailtoUrl(alert);
  assert.match(url, /^mailto:info@example\.com\?subject=/);
  assert.match(decodeURIComponent(url), /テスト建設/);
});
