import { test } from "node:test";
import assert from "node:assert/strict";
import { daysUntil } from "../src/core/reminders/dateUtils.js";

test("daysUntil: 基準日からの残り日数を返す", () => {
  assert.equal(daysUntil("2026-10-01", "2026-09-01"), 30);
  assert.equal(daysUntil("2026-09-01", "2026-09-11"), -10);
});
