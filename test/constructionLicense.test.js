import { test } from "node:test";
import assert from "node:assert/strict";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerConstructionLicense: 'construction'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerConstructionLicense();
  const scheduleFn = getScheduleFn("construction");
  assert.equal(typeof scheduleFn, "function");
});

test("registerConstructionLicense: 登録した関数は許可日から3件のリマインド予定を返す", () => {
  clearScheduleFns();
  registerConstructionLicense();
  const scheduleFn = getScheduleFn("construction");
  const items = scheduleFn({ licenseId: "既定", grantDateIso: "2024-04-01" });
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => i.type),
    ["renewal-early-notice", "renewal-prepare", "renewal-deadline"]
  );
});

test("registerConstructionLicense: grantDateIso未設定の許可は空配列を返す", () => {
  clearScheduleFns();
  registerConstructionLicense();
  const scheduleFn = getScheduleFn("construction");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});
