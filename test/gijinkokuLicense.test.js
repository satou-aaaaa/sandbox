import { test } from "node:test";
import assert from "node:assert/strict";
import { registerGijinkokuModule } from "../src/licenses/gijinkoku/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerGijinkokuModule: 'gijinkoku'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerGijinkokuModule();
  assert.equal(typeof getScheduleFn("gijinkoku"), "function");
});

test("registerGijinkokuModule: gijinkokuDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerGijinkokuModule();
  const scheduleFn = getScheduleFn("gijinkoku");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerGijinkokuModule: 満了日3件、期限90/60/30日前のリマインドを返す", () => {
  clearScheduleFns();
  registerGijinkokuModule();
  const scheduleFn = getScheduleFn("gijinkoku");
  const items = scheduleFn({ licenseId: "既定", gijinkokuDetail: { expiryDateIso: "2026-12-31", periodType: "1年" } });
  assert.equal(items.length, 3);
  assert.equal(items[0].type, "zairyu-early-notice");
  assert.equal(items[0].dueDateIso, "2026-10-02");
  assert.equal(items[1].type, "zairyu-prepare");
  assert.equal(items[1].dueDateIso, "2026-11-01");
  assert.equal(items[2].type, "zairyu-deadline");
  assert.equal(items[2].dueDateIso, "2026-12-01");
});

test("registerGijinkokuModule: 在留期間が3月と短い場合でも同じ計算式で満了90/60/30日前を返す（在留開始前になる境界ケースも計算自体は行う）", () => {
  clearScheduleFns();
  registerGijinkokuModule();
  const scheduleFn = getScheduleFn("gijinkoku");
  const items = scheduleFn({ licenseId: "既定", gijinkokuDetail: { expiryDateIso: "2026-03-31", periodType: "3月" } });
  assert.equal(items.length, 3);
  assert.equal(items[0].dueDateIso, "2025-12-31");
});

test("registerGijinkokuModule: 期限締切のラベルに特例期間の注意書きが含まれる", () => {
  clearScheduleFns();
  registerGijinkokuModule();
  const scheduleFn = getScheduleFn("gijinkoku");
  const items = scheduleFn({ licenseId: "既定", gijinkokuDetail: { expiryDateIso: "2026-12-31" } });
  const deadline = items.find((i) => i.type === "zairyu-deadline");
  assert.ok(deadline.label.includes("特例期間"));
});
