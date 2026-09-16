import { test } from "node:test";
import assert from "node:assert/strict";
import { calcExpiry, calcExpirySchedule } from "../src/core/reminders/expirySchedule.js";

test("calcExpiry: 有効期間5年なら許可日の5年後の前日", () => {
  assert.equal(calcExpiry("2024-04-01", 5), "2029-03-31");
});

test("calcExpiry: 有効期間7年（産廃の優良認定更新相当）なら許可日の7年後の前日", () => {
  assert.equal(calcExpiry("2024-04-01", 7), "2031-03-31");
});

test("calcExpiry: うるう年の2/29起点でも、非うるう年の末日に丸めて計算できる（境界値）", () => {
  assert.equal(calcExpiry("2024-02-29", 5), "2029-02-27");
});

test("calcExpirySchedule: 満了日・準備開始・最終締切・早期検討日を返す", () => {
  const schedule = calcExpirySchedule("2024-04-01", 5);
  assert.equal(schedule.expiryDate, "2029-03-31");
  assert.equal(schedule.hardDeadline, "2029-03-01");
  assert.equal(schedule.recommendedStartDate, "2029-01-30");
  assert.equal(schedule.earlyNoticeDate, "2028-10-02");
});

test("calcExpirySchedule: 有効期間7年でも同じ計算式で満了日以降の日程を算出できる", () => {
  const schedule = calcExpirySchedule("2024-04-01", 7);
  assert.equal(schedule.expiryDate, "2031-03-31");
  assert.equal(schedule.hardDeadline, "2031-03-01");
});
