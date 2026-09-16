import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcYukoKigen,
  calcNextKijunbi,
  calcNextKessanHenkoDeadline,
  calcRecommendedReapplicationDate,
  calcKeieiJikoShinsaSchedule,
} from "../src/licenses/keiei-jiko-shinsa/reminders/annualCycleSchedule.js";

test("calcYukoKigen: 審査基準日から1年7ヶ月（19ヶ月）後を返す", () => {
  assert.equal(calcYukoKigen("2025-03-31"), "2026-10-31");
});

test("calcYukoKigen: 月末日（うるう年）を起点にしても存在しない月へは丸められる（境界値）", () => {
  // 2024-02-29 + 19ヶ月 = 2025-09-29（29日は9月に存在するのでそのまま）
  assert.equal(calcYukoKigen("2024-02-29"), "2025-09-29");
});

test("calcNextKijunbi: 直近審査基準日の1年後を返す", () => {
  assert.equal(calcNextKijunbi("2025-03-31"), "2026-03-31");
});

test("calcNextKijunbi: うるう年2/29起点だと非うるう年では2/28に丸められる（境界値）", () => {
  assert.equal(calcNextKijunbi("2024-02-29"), "2025-02-28");
});

test("calcNextKessanHenkoDeadline: 次回審査基準日の4ヶ月後を返す", () => {
  assert.equal(calcNextKessanHenkoDeadline("2026-03-31"), "2026-07-31");
});

test("calcNextKessanHenkoDeadline: 年をまたぐ場合も正しく計算される（境界値）", () => {
  assert.equal(calcNextKessanHenkoDeadline("2026-11-30"), "2027-03-30");
});

test("calcRecommendedReapplicationDate: 決算変更届提出期限のさらに1ヶ月後を返す", () => {
  assert.equal(calcRecommendedReapplicationDate("2026-03-31"), "2026-08-31");
});

test("calcKeieiJikoShinsaSchedule: keieiJikoShinsaDetail未設定（未受審）の場合は空配列を返す", () => {
  assert.deepEqual(calcKeieiJikoShinsaSchedule({ licenseId: "経審" }), []);
  assert.deepEqual(calcKeieiJikoShinsaSchedule({ licenseId: "経審", keieiJikoShinsaDetail: {} }), []);
});

test("calcKeieiJikoShinsaSchedule: 直近審査基準日が設定されていれば3件のリマインドを返す", () => {
  const items = calcKeieiJikoShinsaSchedule({ licenseId: "経審", keieiJikoShinsaDetail: { latestKijunbiIso: "2025-03-31" } });
  assert.equal(items.length, 3);
  assert.equal(items[0].type, "keiei-next-kessan-henko");
  assert.equal(items[0].dueDateIso, "2026-07-31"); // 次回基準日(2026-03-31)+4ヶ月
  assert.equal(items[1].type, "keiei-recommended-reapplication");
  assert.equal(items[1].dueDateIso, "2026-08-31"); // 上記+1ヶ月
  assert.equal(items[2].type, "keiei-validity-deadline");
  assert.equal(items[2].dueDateIso, "2026-10-31"); // 直近基準日(2025-03-31)+19ヶ月
});

test("calcKeieiJikoShinsaSchedule: 結果通知日（latestKekkaTsuchibiIso）は有効期限の起点に使わない", () => {
  const items = calcKeieiJikoShinsaSchedule({
    licenseId: "経審",
    keieiJikoShinsaDetail: { latestKijunbiIso: "2025-03-31", latestKekkaTsuchibiIso: "2025-09-01" },
  });
  const deadline = items.find((i) => i.type === "keiei-validity-deadline");
  assert.equal(deadline.dueDateIso, "2026-10-31"); // latestKekkaTsuchibiIsoではなくlatestKijunbiIso基準
});
