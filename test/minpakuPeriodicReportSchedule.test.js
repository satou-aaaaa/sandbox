import { test } from "node:test";
import assert from "node:assert/strict";
import { calcNextReportDeadline, calcMinpakuSchedule } from "../src/licenses/minpaku/reminders/periodicReportSchedule.js";

test("calcNextReportDeadline: 各固定月の前日ならその月の15日が次回期限", () => {
  assert.equal(calcNextReportDeadline("2026-02-14"), "2026-02-15");
  assert.equal(calcNextReportDeadline("2026-04-14"), "2026-04-15");
});

test("calcNextReportDeadline: 固定日当日ならその日自身が次回期限（境界値）", () => {
  assert.equal(calcNextReportDeadline("2026-02-15"), "2026-02-15");
});

test("calcNextReportDeadline: 固定日の翌日なら次の固定月へ進む（境界値）", () => {
  assert.equal(calcNextReportDeadline("2026-02-16"), "2026-04-15");
});

test("calcNextReportDeadline: 固定月でない月なら次に到来する固定月の15日", () => {
  assert.equal(calcNextReportDeadline("2026-03-01"), "2026-04-15");
  assert.equal(calcNextReportDeadline("2026-01-01"), "2026-02-15");
});

test("calcNextReportDeadline: 12/15を過ぎていれば年をまたいで翌年2/15になる（境界値）", () => {
  assert.equal(calcNextReportDeadline("2026-12-16"), "2027-02-15");
  assert.equal(calcNextReportDeadline("2026-12-31"), "2027-02-15");
});

test("calcMinpakuSchedule: notificationDateIso未設定なら空配列（届出前は報告義務なし）", () => {
  assert.deepEqual(calcMinpakuSchedule({ licenseId: "既定" }), []);
  assert.deepEqual(calcMinpakuSchedule({ licenseId: "既定", minpakuDetail: {} }), []);
});

test("calcMinpakuSchedule: 届出済みなら本日を基準にした次回固定日を返す（届出日そのものには依存しない）", () => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const expected = calcNextReportDeadline(todayIso);

  const items = calcMinpakuSchedule({
    licenseId: "既定",
    minpakuDetail: { notificationDateIso: "2020-01-01" }, // 大幅に過去の届出日でも影響しないことを確認
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "minpaku-periodic-report");
  assert.equal(items[0].dueDateIso, expected);
});
