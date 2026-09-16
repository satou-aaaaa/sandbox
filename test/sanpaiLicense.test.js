import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSanpaiLicense } from "../src/licenses/sanpai/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerSanpaiLicense: 'sanpai'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerSanpaiLicense();
  assert.equal(typeof getScheduleFn("sanpai"), "function");
});

test("registerSanpaiLicense: grantDateIso・sanpaiDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerSanpaiLicense();
  const scheduleFn = getScheduleFn("sanpai");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerSanpaiLicense: grantDateIsoのみあれば更新の2件（準備開始・最終締切）を返す（有効期間未設定＝5年）", () => {
  clearScheduleFns();
  registerSanpaiLicense();
  const scheduleFn = getScheduleFn("sanpai");
  const items = scheduleFn({ licenseId: "既定", grantDateIso: "2024-04-01" });
  assert.equal(items.length, 2);
  assert.equal(items[0].type, "sanpai-renewal-prepare");
  assert.equal(items[1].type, "sanpai-renewal-deadline");
  assert.equal(items[1].dueDateIso, "2029-03-01"); // 5年後の満了日(2029-03-31)の30日前
});

test("registerSanpaiLicense: 優良認定（validityYears: 7）が設定されていれば7年基準で計算する", () => {
  clearScheduleFns();
  registerSanpaiLicense();
  const scheduleFn = getScheduleFn("sanpai");
  const items = scheduleFn({
    licenseId: "既定",
    grantDateIso: "2024-04-01",
    sanpaiDetail: { validityYears: 7 },
  });
  assert.equal(items[1].dueDateIso, "2031-03-01"); // 7年後の満了日(2031-03-31)の30日前
});

test("registerSanpaiLicense: 講習修了証発行日が記録されていれば有効期限（5年後）のリマインドを返す", () => {
  clearScheduleFns();
  registerSanpaiLicense();
  const scheduleFn = getScheduleFn("sanpai");
  const items = scheduleFn({
    licenseId: "既定",
    sanpaiDetail: { koushuCompletionDateIso: "2024-04-01" },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "sanpai-koushu-expiry");
  assert.equal(items[0].dueDateIso, "2029-04-01");
});

test("registerSanpaiLicense: 更新と講習修了証の両方が記録されていれば3件返す", () => {
  clearScheduleFns();
  registerSanpaiLicense();
  const scheduleFn = getScheduleFn("sanpai");
  const items = scheduleFn({
    licenseId: "既定",
    grantDateIso: "2024-04-01",
    sanpaiDetail: { koushuCompletionDateIso: "2024-04-01" },
  });
  assert.equal(items.length, 3);
});
