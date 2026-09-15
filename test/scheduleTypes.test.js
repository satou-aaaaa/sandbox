import { test } from "node:test";
import assert from "node:assert/strict";
import { registerScheduleFn, getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("getScheduleFn: 未登録のキーはundefinedを返す", () => {
  clearScheduleFns();
  assert.equal(getScheduleFn("no-such-category"), undefined);
});

test("registerScheduleFn → getScheduleFn: 登録した関数をそのまま取得できる", () => {
  clearScheduleFns();
  const fn = () => [{ type: "test", label: "テスト", dueDateIso: "2026-01-01" }];
  registerScheduleFn("test-category", fn);
  assert.equal(getScheduleFn("test-category"), fn);
});

test("registerScheduleFn: 同じキーで再登録すると上書きされる", () => {
  clearScheduleFns();
  const fn1 = () => [];
  const fn2 = () => [];
  registerScheduleFn("test-category", fn1);
  registerScheduleFn("test-category", fn2);
  assert.equal(getScheduleFn("test-category"), fn2);
});

test("clearScheduleFns: すべての登録済み関数を消去する", () => {
  registerScheduleFn("test-category", () => []);
  clearScheduleFns();
  assert.equal(getScheduleFn("test-category"), undefined);
});
