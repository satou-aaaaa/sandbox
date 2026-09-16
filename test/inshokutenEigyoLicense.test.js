import { test } from "node:test";
import assert from "node:assert/strict";
import { registerInshokutenEigyoLicense } from "../src/licenses/inshokuten-eigyo/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerInshokutenEigyoLicense: 'inshokuten-eigyo'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  assert.equal(typeof getScheduleFn("inshokuten-eigyo"), "function");
});

test("registerInshokutenEigyoLicense: inshokutenDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  const scheduleFn = getScheduleFn("inshokuten-eigyo");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerInshokutenEigyoLicense: validityYears未入力（許可証交付前）の場合は空配列を返す", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  const scheduleFn = getScheduleFn("inshokuten-eigyo");
  const items = scheduleFn({ licenseId: "既定", inshokutenDetail: { grantDateIso: "2026-04-01" } });
  assert.deepEqual(items, []);
});

test("registerInshokutenEigyoLicense: grantDateIso未入力の場合も空配列を返す", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  const scheduleFn = getScheduleFn("inshokuten-eigyo");
  const items = scheduleFn({ licenseId: "既定", inshokutenDetail: { validityYears: 6 } });
  assert.deepEqual(items, []);
});

test("registerInshokutenEigyoLicense: 有効期間6年で満了180/60/30日前のリマインドを返す", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  const scheduleFn = getScheduleFn("inshokuten-eigyo");
  const items = scheduleFn({ licenseId: "既定", inshokutenDetail: { grantDateIso: "2020-04-01", validityYears: 6 } });
  assert.equal(items.length, 3);
  assert.equal(items[0].type, "inshokuten-koshin-early-notice");
  assert.equal(items[0].dueDateIso, "2025-10-02");
  assert.equal(items[1].type, "inshokuten-koshin-prepare");
  assert.equal(items[1].dueDateIso, "2026-01-30");
  assert.equal(items[2].type, "inshokuten-koshin-deadline");
  assert.equal(items[2].dueDateIso, "2026-03-01");
});

for (const validityYears of [5, 6, 7, 8]) {
  test(`registerInshokutenEigyoLicense: 有効期間${validityYears}年でも3件のリマインドを算出できる`, () => {
    clearScheduleFns();
    registerInshokutenEigyoLicense();
    const scheduleFn = getScheduleFn("inshokuten-eigyo");
    const items = scheduleFn({ licenseId: "既定", inshokutenDetail: { grantDateIso: "2026-04-01", validityYears } });
    assert.equal(items.length, 3);
  });
}

test("registerInshokutenEigyoLicense: うるう年（2/29）許可を起点にした年数加算で満了日がクランプされる", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  const scheduleFn = getScheduleFn("inshokuten-eigyo");
  const items = scheduleFn({ licenseId: "既定", inshokutenDetail: { grantDateIso: "2024-02-29", validityYears: 5 } });
  assert.equal(items.length, 3);
  assert.equal(items[2].dueDateIso, "2029-01-28");
});

test("registerInshokutenEigyoLicense: 更新締切ラベルに有効期間年数が含まれる", () => {
  clearScheduleFns();
  registerInshokutenEigyoLicense();
  const scheduleFn = getScheduleFn("inshokuten-eigyo");
  const items = scheduleFn({ licenseId: "既定", inshokutenDetail: { grantDateIso: "2026-04-01", validityYears: 8 } });
  assert.ok(items[0].label.includes("8年"));
});
