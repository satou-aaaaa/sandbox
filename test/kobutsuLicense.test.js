import { test } from "node:test";
import assert from "node:assert/strict";
import { registerKobutsuLicense } from "../src/licenses/kobutsu/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerKobutsuLicense: 'kobutsu'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerKobutsuLicense();
  assert.equal(typeof getScheduleFn("kobutsu"), "function");
});

test("registerKobutsuLicense: kobutsuDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerKobutsuLicense();
  const scheduleFn = getScheduleFn("kobutsu");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerKobutsuLicense: 記載事項変更の記録があれば書換申請の期限を返す", () => {
  clearScheduleFns();
  registerKobutsuLicense();
  const scheduleFn = getScheduleFn("kobutsu");
  const items = scheduleFn({
    licenseId: "既定",
    kobutsuDetail: { lastRecordedChangeDateIso: "2026-09-01" },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "shokan-shinsei");
  assert.equal(items[0].dueDateIso, "2026-09-15");
});

test("registerKobutsuLicense: 廃業の記録があれば返納期限を返す", () => {
  clearScheduleFns();
  registerKobutsuLicense();
  const scheduleFn = getScheduleFn("kobutsu");
  const items = scheduleFn({
    licenseId: "既定",
    kobutsuDetail: { closureDateIso: "2026-09-01" },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "henou");
  assert.equal(items[0].dueDateIso, "2026-09-11");
});

test("registerKobutsuLicense: 変更と廃業の両方が記録されていれば2件返す", () => {
  clearScheduleFns();
  registerKobutsuLicense();
  const scheduleFn = getScheduleFn("kobutsu");
  const items = scheduleFn({
    licenseId: "既定",
    kobutsuDetail: { lastRecordedChangeDateIso: "2026-09-01", closureDateIso: "2026-09-05" },
  });
  assert.equal(items.length, 2);
});
