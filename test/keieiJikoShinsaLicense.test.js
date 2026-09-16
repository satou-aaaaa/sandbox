import { test } from "node:test";
import assert from "node:assert/strict";
import { registerKeieiJikoShinsaLicense } from "../src/licenses/keiei-jiko-shinsa/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerKeieiJikoShinsaLicense: 'keiei-jiko-shinsa'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerKeieiJikoShinsaLicense();
  assert.equal(typeof getScheduleFn("keiei-jiko-shinsa"), "function");
});

test("registerKeieiJikoShinsaLicense: keieiJikoShinsaDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerKeieiJikoShinsaLicense();
  const scheduleFn = getScheduleFn("keiei-jiko-shinsa");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerKeieiJikoShinsaLicense: 審査基準日が記録されていれば3件のリマインドを返す", () => {
  clearScheduleFns();
  registerKeieiJikoShinsaLicense();
  const scheduleFn = getScheduleFn("keiei-jiko-shinsa");
  const items = scheduleFn({ licenseId: "経審", keieiJikoShinsaDetail: { latestKijunbiIso: "2025-03-31" } });
  assert.equal(items.length, 3);
});
