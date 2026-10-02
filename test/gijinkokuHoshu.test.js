import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHoshu } from "../src/licenses/gijinkoku/eligibility/hoshu.js";

test("checkHoshu: 提示年収が比較水準を上回れば合格する", () => {
  const result = checkHoshu({ offeredSalaryAnnual: 5_000_000, comparableJapaneseSalaryAnnual: 4_000_000 });
  assert.equal(result.key, "hoshu");
  assert.equal(result.label, "報酬要件（日本人と同等額以上）");
  assert.equal(result.passed, true);
  assert.equal(result.reasons[0], "提示年収 5,000,000円は比較水準（4,000,000円）以上です");
  assert.deepEqual(result.warnings, []);
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
