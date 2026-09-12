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

test("更新スケジュールは早期の準備検討日（満了180日前）も返す（M7）", () => {
  const schedule = calcRenewalSchedule("2024-04-01");
  assert.equal(schedule.expiryDate, "2029-03-31");
  assert.equal(schedule.earlyNoticeDate, "2028-10-02"); // 満了日の180日前
});

test("早期の準備検討日（180日前）は月境界をまたぐ場合も正しく計算される（M7）", () => {
  // 満了日が月初付近だと、180日引くと前年の月をまたぐ（うるう年の2月も含む）。
  const schedule = calcRenewalSchedule("2021-03-01"); // 満了日: 2026-02-28（2026年は平年）
  assert.equal(schedule.expiryDate, "2026-02-28");
  assert.equal(schedule.earlyNoticeDate, "2025-09-01"); // 満了日の180日前
});

test("許可満了日: 許可日がうるう年の2/29でも5年後の非うるう年に丸めて計算できる（境界値）", () => {
  // 2024年はうるう年（2/29が存在）だが、5年後の2029年は平年で2/29が存在しない。
  // addMonthsClamped が対象月の末日（2029年2月28日）に丸め、その前日を返すため
  // 満了日は2029-02-27になる。
  assert.equal(calcLicenseExpiry("2024-02-29"), "2029-02-27");
});

test("決算変更届は事業年度終了後4ヶ月以内", () => {
  assert.equal(calcKessanHenkoDeadline("2026-03-31"), "2026-07-31");
  assert.equal(calcKessanHenkoDeadline("2025-12-31"), "2026-04-30");
});

test("決算変更届: 事業年度終了日がうるう年の2/29でも4ヶ月後の月に同じ日が存在すれば丸めずに計算できる（境界値）", () => {
  assert.equal(calcKessanHenkoDeadline("2024-02-29"), "2024-06-29");
});

test("daysUntil は基準日からの残り日数を返す", () => {
  assert.equal(daysUntil("2026-10-01", "2026-09-01"), 30);
  assert.equal(daysUntil("2026-09-01", "2026-09-11"), -10);
});
