import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeAlertsForNotification } from "../src/core/reminders/dailySummary.js";
import { registerAllLicenses } from "../src/licenses/registerAll.js";
import { getScheduleFn } from "../src/core/reminders/scheduleTypes.js";

const alert = (daysUntil, clientName = "株式会社テスト", dueDateIso = "2026-10-01") => ({ clientName, type: "x", label: "秘密の許可の期限", dueDateIso, daysUntil, isOverdue: daysUntil < 0 });

test("summarizeAlertsForNotification: 期限超過・7日以内・30日以内を数え、最短期限を示す", () => {
  const s = summarizeAlertsForNotification([alert(-3, "A社", "2026-09-27"), alert(0), alert(7), alert(8), alert(30), alert(31), alert(90)]);
  assert.equal(s.overdue, 1);
  assert.equal(s.within7, 2);
  assert.equal(s.within30, 2);
  assert.equal(s.total, 7);
  assert.equal(s.nearestDueDateIso, "2026-09-27");
  assert.equal(s.nearestDaysUntil, -3);
  assert.match(s.line, /期限超過 1件／7日以内 2件／30日以内 2件／最短 2026-09-27（3日超過）/);
});

test("summarizeAlertsForNotification: 要約の1行にクライアント名・ラベルを含めない（個人情報を通知に載せない）", () => {
  const s = summarizeAlertsForNotification([alert(5, "山田太郎商店")]);
  assert.doesNotMatch(s.line, /山田|商店|秘密/);
  assert.match(s.line, /あと5日/);
});

test("summarizeAlertsForNotification: 順序に依存せず最短を選ぶ。項目なしなら『リマインド項目なし』", () => {
  assert.equal(summarizeAlertsForNotification([alert(20), alert(2), alert(9)]).nearestDaysUntil, 2);
  const none = summarizeAlertsForNotification([]);
  assert.equal(none.total, 0);
  assert.equal(none.nearestDueDateIso, null);
  assert.match(none.line, /リマインド項目なし/);
});

test("registerAllLicenses: すべての許可種別のスケジュール関数が登録される", () => {
  registerAllLicenses();
  for (const category of ["construction", "kobutsu", "sanpai", "minpaku", "gijinkoku", "keiei-jiko-shinsa", "nouchi-tenyo", "inshokuten-eigyo", "tokutei-ginou"]) {
    assert.equal(typeof getScheduleFn(category), "function", `${category} が未登録`);
  }
});

test("registerAllLicenses: src/web/server.js が登録しているアドオンを、すべて含んでいる（登録漏れの防止）", () => {
  const server = readFileSync(new URL("../src/web/server.js", import.meta.url), "utf8");
  const registerAll = readFileSync(new URL("../src/licenses/registerAll.js", import.meta.url), "utf8");
  const fnNames = [...server.matchAll(/^\s*(register\w+)\(\);/gm)].map((m) => m[1]);
  assert.ok(fnNames.length >= 9);
  for (const fn of fnNames) assert.ok(registerAll.includes(`${fn}();`), `${fn} が registerAll.js に無い`);
});
