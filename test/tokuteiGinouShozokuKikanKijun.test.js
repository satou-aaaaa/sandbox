import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShozokuKikanKijun } from "../src/licenses/tokutei-ginou/eligibility/shozokuKikanKijun.js";

function baseInput(overrides = {}) {
  return {
    companyName: "サンプル株式会社",
    noLaborLawViolationWithin5Years: true,
    noImmigrationLawViolationWithin5Years: true,
    offeredSalaryAnnual: 4_000_000,
    comparableJapaneseSalaryAnnual: 3_800_000,
    ...overrides,
  };
}

test("checkShozokuKikanKijun: 全項目を満たす場合はpassed=trueになる", () => {
  const result = checkShozokuKikanKijun(baseInput());
  assert.equal(result.passed, true);
});

test("checkShozokuKikanKijun: 労働関係法令違反がある場合はpassed=falseになる", () => {
  const result = checkShozokuKikanKijun(baseInput({ noLaborLawViolationWithin5Years: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("労働関係法令違反")));
});

test("checkShozokuKikanKijun: 入管法令違反がある場合はpassed=falseになる", () => {
  const result = checkShozokuKikanKijun(baseInput({ noImmigrationLawViolationWithin5Years: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("入管法令違反")));
});

test("checkShozokuKikanKijun: 提示年収が比較水準を下回る場合はpassed=falseになる", () => {
  const result = checkShozokuKikanKijun(baseInput({ offeredSalaryAnnual: 3_000_000 }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("年収水準")));
});

test("checkShozokuKikanKijun: 提示年収が比較水準と同額の場合はpassed=trueになる（同等以上）", () => {
  const result = checkShozokuKikanKijun(baseInput({ offeredSalaryAnnual: 3_800_000, comparableJapaneseSalaryAnnual: 3_800_000 }));
  assert.equal(result.passed, true);
});
