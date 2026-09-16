import { test } from "node:test";
import assert from "node:assert/strict";
import { registerMinpakuLicense } from "../src/licenses/minpaku/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerMinpakuLicense: 'minpaku'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerMinpakuLicense();
  assert.equal(typeof getScheduleFn("minpaku"), "function");
});

test("registerMinpakuLicense: minpakuDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerMinpakuLicense();
  const scheduleFn = getScheduleFn("minpaku");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerMinpakuLicense: 届出日が記録されていれば定期報告リマインドを1件返す", () => {
  clearScheduleFns();
  registerMinpakuLicense();
  const scheduleFn = getScheduleFn("minpaku");
  const items = scheduleFn({ licenseId: "既定", minpakuDetail: { notificationDateIso: "2026-01-01" } });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "minpaku-periodic-report");
});
