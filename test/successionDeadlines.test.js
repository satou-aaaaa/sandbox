import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcSouzokuHoukiDeadline,
  calcSouzokuzeiShinkokuDeadline,
  calcIryuubunSeikyuDeadlines,
  buildSuccessionDeadlineAlerts,
} from "../src/succession/reminders/souzokuDeadlines.js";
import { buildSampleSuccessionCase } from "../scripts/sampleSuccessionCase.js";

test("calcSouzokuHoukiDeadline: 知った日から3ヶ月後の期限を計算する（民法915条1項）", () => {
  const result = calcSouzokuHoukiDeadline("2026-06-01");
  assert.equal(result.dueDateIso, "2026-09-01");
  assert.match(result.label, /弁護士・司法書士/);
});

test("calcSouzokuHoukiDeadline: 月末日をまたぐ場合にクランプされる（1/31 + 3ヶ月 → 4/30）", () => {
  const result = calcSouzokuHoukiDeadline("2026-01-31");
  assert.equal(result.dueDateIso, "2026-04-30");
});

test("calcSouzokuzeiShinkokuDeadline: 知った日の翌日から10ヶ月後の期限を計算する（相続税法27条）", () => {
  const result = calcSouzokuzeiShinkokuDeadline("2026-06-01");
  // 翌日(6/2)から10ヶ月後 → 2027-04-02
  assert.equal(result.dueDateIso, "2027-04-02");
  assert.match(result.label, /税理士/);
});

test("calcSouzokuzeiShinkokuDeadline: 年またぎでも正しく計算される", () => {
  const result = calcSouzokuzeiShinkokuDeadline("2026-12-31");
  // 翌日(2027-01-01)から10ヶ月後 → 2027-11-01
  assert.equal(result.dueDateIso, "2027-11-01");
});

test("calcIryuubunSeikyuDeadlines: 知った時から1年・相続開始から10年の両方を返す（民法1048条）", () => {
  const [oneYear, tenYears] = calcIryuubunSeikyuDeadlines("2026-06-01", "2026-07-01");
  assert.equal(oneYear.type, "iryuubun-1nen");
  assert.equal(oneYear.dueDateIso, "2027-07-01");
  assert.equal(tenYears.type, "iryuubun-10nen");
  assert.equal(tenYears.dueDateIso, "2036-06-01");
  assert.match(oneYear.label, /弁護士/);
});

test("calcIryuubunSeikyuDeadlines: 知った日が省略された場合、死亡日を起点として1年の期限も計算する", () => {
  const [oneYear] = calcIryuubunSeikyuDeadlines("2026-06-01");
  assert.equal(oneYear.dueDateIso, "2027-06-01");
});

test("calcIryuubunSeikyuDeadlines: うるう年をまたいでも正しく計算される（2024-02-29起点の10年後）", () => {
  const [, tenYears] = calcIryuubunSeikyuDeadlines("2024-02-29");
  assert.equal(tenYears.dueDateIso, "2034-02-28");
});

test("buildSuccessionDeadlineAlerts: 未完了案件から4件（相続放棄・相続税申告・遺留分×2）のリマインドを返す", () => {
  const c = buildSampleSuccessionCase();
  const alerts = buildSuccessionDeadlineAlerts([c], "2026-06-01");
  assert.equal(alerts.length, 4);
});

test("buildSuccessionDeadlineAlerts: 完了済み案件は除外される", () => {
  const c = buildSampleSuccessionCase();
  c.status = "完了";
  const alerts = buildSuccessionDeadlineAlerts([c], "2026-06-01");
  assert.deepEqual(alerts, []);
});

test("buildSuccessionDeadlineAlerts: 「知った日」が死亡日と異なる場合、正しい起点で計算される（FR-S4.5）", () => {
  const c = buildSampleSuccessionCase();
  c.decedentDeathKnownDateIso = "2026-08-01"; // 死亡から2ヶ月後に知った
  const alerts = buildSuccessionDeadlineAlerts([c], "2026-06-01");
  const houki = alerts.find((a) => a.type === "souzoku-houki");
  assert.equal(houki.dueDateIso, "2026-11-01"); // 知った日(8/1)から3ヶ月後
});

test("buildSuccessionDeadlineAlerts: 日付の近い順にソートされる", () => {
  const c = buildSampleSuccessionCase();
  const alerts = buildSuccessionDeadlineAlerts([c], "2026-06-01");
  for (let i = 1; i < alerts.length; i++) {
    assert.ok(alerts[i].daysUntil >= alerts[i - 1].daysUntil);
  }
});
