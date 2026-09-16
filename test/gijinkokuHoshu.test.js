import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHoshu } from "../src/licenses/gijinkoku/eligibility/hoshu.js";

test("checkHoshu: 提示年収が比較水準を上回れば合格する", () => {
  const result = checkHoshu({ offeredSalaryAnnual: 5_000_000, comparableJapaneseSalaryAnnual: 4_000_000 });
  assert.equal(result.passed, true);
});

test("checkHoshu: 提示年収が比較水準とちょうど同額なら合格する（境界値）", () => {
  const result = checkHoshu({ offeredSalaryAnnual: 4_000_000, comparableJapaneseSalaryAnnual: 4_000_000 });
  assert.equal(result.passed, true);
});

test("checkHoshu: 提示年収が比較水準を下回れば不合格になる", () => {
  const result = checkHoshu({ offeredSalaryAnnual: 3_500_000, comparableJapaneseSalaryAnnual: 4_000_000 });
  assert.equal(result.passed, false);
  assert.ok(result.reasons[0].includes("下回っています"));
});
