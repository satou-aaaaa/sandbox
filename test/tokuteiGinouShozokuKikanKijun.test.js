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

test("checkShozokuKikanKijun: 全項目を満たす場合のkey・label・reasons・warningsを厳密に確認", () => {
  const result = checkShozokuKikanKijun(baseInput());
  assert.equal(result.passed, true);
  assert.equal(result.key, "shozokuKikanKijun");
  assert.equal(result.label, "特定技能所属機関の基準");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reasons, [
    "サンプル株式会社は特定技能所属機関としての基準（労働関係法令・入管法令の遵守実績、報酬水準）を満たしています",
  ]);
});

test("checkShozokuKikanKijun: 違反がある場合は合格メッセージを含まない（労働関係法令違反の例）", () => {
  const result = checkShozokuKikanKijun(baseInput({ noLaborLawViolationWithin5Years: false }));
  assert.ok(!result.reasons.some((r) => r.includes("特定技能所属機関としての基準")));
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
