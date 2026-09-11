import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcLicenseExpiry,
  calcRenewalSchedule,
  calcKessanHenkoDeadline,
  daysUntil,
} from "../src/reminders/renewalSchedule.js";

test("許可満了日は許可日の5年後の前日", () => {
  assert.equal(calcLicenseExpiry("2024-04-01"), "2029-03-31");
  assert.equal(calcLicenseExpiry("2026-09-11"), "2031-09-10");
});

test("更新スケジュールは満了日・準備開始・最終締切を返す", () => {
  const schedule = calcRenewalSchedule("2024-04-01");
  assert.equal(schedule.expiryDate, "2029-03-31");
  assert.equal(schedule.hardDeadline, "2029-03-01"); // 満了日の30日前
  assert.equal(schedule.recommendedStartDate, "2029-01-30"); // 満了日の60日前
});

test("決算変更届は事業年度終了後4ヶ月以内", () => {
  assert.equal(calcKessanHenkoDeadline("2026-03-31"), "2026-07-31");
  assert.equal(calcKessanHenkoDeadline("2025-12-31"), "2026-04-30");
});

test("daysUntil は基準日からの残り日数を返す", () => {
  assert.equal(daysUntil("2026-10-01", "2026-09-01"), 30);
  assert.equal(daysUntil("2026-09-01", "2026-09-11"), -10);
});
