import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIppanKijun } from "../src/licenses/nouchi-tenyo/eligibility/ippanKijun.js";

function completeInput() {
  return { hasSufficientFundsAndCredit: true, hasConstructionSchedule: true, hasNeighborDamagePreventionMeasures: true, hasNeighborConsent: true };
}

test("checkIppanKijun: すべて満たせば合格", () => {
  const result = checkIppanKijun(completeInput());
  assert.equal(result.passed, true);
});

test("checkIppanKijun: 資力・信用が無ければ不合格", () => {
  const result = checkIppanKijun({ ...completeInput(), hasSufficientFundsAndCredit: false });
  assert.equal(result.passed, false);
});

test("checkIppanKijun: 工事計画が無ければ不合格", () => {
  const result = checkIppanKijun({ ...completeInput(), hasConstructionSchedule: false });
  assert.equal(result.passed, false);
});

test("checkIppanKijun: 被害防除措置が無ければ不合格", () => {
  const result = checkIppanKijun({ ...completeInput(), hasNeighborDamagePreventionMeasures: false });
  assert.equal(result.passed, false);
});

test("checkIppanKijun: 隣接同意が未取得でも合否には影響しないが警告が出る", () => {
  const result = checkIppanKijun({ ...completeInput(), hasNeighborConsent: false });
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
});
