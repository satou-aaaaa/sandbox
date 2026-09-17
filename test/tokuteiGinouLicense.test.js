import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTokuteiGinouModule } from "../src/licenses/tokutei-ginou/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";
import { clearFields, listFields } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";

test("registerTokuteiGinouModule: 'tokutei-ginou'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  clearFields();
  registerTokuteiGinouModule();
  assert.equal(typeof getScheduleFn("tokutei-ginou"), "function");
});

test("registerTokuteiGinouModule: 呼び出すと分野レジストリに19分野が投入される", () => {
  clearScheduleFns();
  clearFields();
  registerTokuteiGinouModule();
  assert.equal(listFields().length, 19);
});

test("registerTokuteiGinouModule: tokuteiGinouDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  clearFields();
  registerTokuteiGinouModule();
  const scheduleFn = getScheduleFn("tokutei-ginou");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerTokuteiGinouModule: 満了日設定済みの許可は3件のリマインドを返す", () => {
  clearScheduleFns();
  clearFields();
  registerTokuteiGinouModule();
  const scheduleFn = getScheduleFn("tokutei-ginou");
  const items = scheduleFn({ licenseId: "既定", tokuteiGinouDetail: { fieldKey: "gaishokugyou", expiryDateIso: "2026-12-31" } });
  assert.equal(items.length, 3);
});

test("registerTokuteiGinouModule: 他の許可種別（construction等）のリマインド生成に影響を与えない（回帰確認）", () => {
  clearScheduleFns();
  clearFields();
  registerTokuteiGinouModule();
  assert.equal(getScheduleFn("construction"), undefined);
  assert.equal(getScheduleFn("kobutsu"), undefined);
  assert.equal(getScheduleFn("gijinkoku"), undefined);
});
