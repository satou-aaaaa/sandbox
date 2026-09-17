import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcTokuteiGinouSchedule,
  calcGonenJougenDate,
  checkExceedsGonenJougen,
} from "../src/licenses/tokutei-ginou/reminders/tokuteiGinouSchedule.js";

test("calcGonenJougenDate: 起算日から5年後の日付を計算する", () => {
  assert.equal(calcGonenJougenDate("2026-04-01"), "2031-04-01");
});

test("calcGonenJougenDate: うるう年（2/29起点）を5年後に加算すると2/29が存在しない年になる場合がある", () => {
  // 2024-02-29 + 5年 → 2029年は閏年ではないため、UTC日付計算上は2029-03-01になる
  // （Date.UTCの繰り上がり仕様に基づく近似計算。正確な計算は今後の課題として設計書9章に明記済み）
  const result = calcGonenJougenDate("2024-02-29");
  assert.equal(result, "2029-03-01");
});

test("checkExceedsGonenJougen: 次回更新候補期限が上限を超える場合はexceedsCap=trueになる", () => {
  const result = checkExceedsGonenJougen("2026-04-01", "2031-06-01");
  assert.equal(result.exceedsCap, true);
  assert.equal(result.capDateIso, "2031-04-01");
});

test("checkExceedsGonenJougen: 次回更新候補期限が上限を超えない場合はexceedsCap=falseになる", () => {
  const result = checkExceedsGonenJougen("2026-04-01", "2031-03-01");
  assert.equal(result.exceedsCap, false);
});

test("checkExceedsGonenJougen: 次回更新候補期限がちょうど上限日の場合はexceedsCap=falseになる（境界値）", () => {
  const result = checkExceedsGonenJougen("2026-04-01", "2031-04-01");
  assert.equal(result.exceedsCap, false);
});

test("calcTokuteiGinouSchedule: tokuteiGinouDetail未設定の場合は空配列を返す", () => {
  assert.deepEqual(calcTokuteiGinouSchedule({ licenseId: "既定" }), []);
});

test("calcTokuteiGinouSchedule: expiryDateIsoのみ設定の場合、満了リマインド3件を返す", () => {
  const items = calcTokuteiGinouSchedule({ licenseId: "既定", tokuteiGinouDetail: { fieldKey: "gaishokugyou", expiryDateIso: "2026-12-31" } });
  assert.equal(items.length, 3);
  assert.equal(items[0].type, "zairyu-early-notice");
  assert.equal(items[0].dueDateIso, "2026-10-02");
  assert.equal(items[1].type, "zairyu-prepare");
  assert.equal(items[2].type, "zairyu-deadline");
});

test("calcTokuteiGinouSchedule: cumulativeStayStartDateIsoのみ設定の場合、通算上限警告1件を返す", () => {
  const items = calcTokuteiGinouSchedule({
    licenseId: "既定",
    tokuteiGinouDetail: { fieldKey: "gaishokugyou", cumulativeStayStartDateIso: "2026-04-01" },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "gonen-jougen-keikoku");
  assert.equal(items[0].dueDateIso, "2030-10-03");
});

test("calcTokuteiGinouSchedule: 両方設定の場合、満了リマインド3件+通算上限警告1件の計4件を返す", () => {
  const items = calcTokuteiGinouSchedule({
    licenseId: "既定",
    tokuteiGinouDetail: { fieldKey: "gaishokugyou", expiryDateIso: "2026-12-31", cumulativeStayStartDateIso: "2026-04-01" },
  });
  assert.equal(items.length, 4);
});
