import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInputCompleteness } from "../src/licenses/keiei-jiko-shinsa/eligibility/inputCompleteness.js";
import { checkYBunsekiStatus } from "../src/licenses/keiei-jiko-shinsa/eligibility/yStatus.js";

function completeInputs() {
  return {
    x1: { annualCompletedWorkAmounts: [100_000_000, 120_000_000], averagingMethod: "2年平均" },
    x2: { latestNetAssets: 50_000_000, averageProfitBeforeInterest: 5_000_000 },
    z: { technicalStaff: [{ qualification: "1級土木施工管理技士", count: 2 }], averageDirectContractCompletedWorkAmount: 80_000_000 },
    w: { isSocialInsuranceEnrolled: true, yearsInBusiness: 10, hasDisasterAgreement: false, hasBusinessSuspensionWithin1Year: false, isIso9001Registered: false, isIso14001Registered: false },
  };
}

test("checkInputCompleteness: すべて入力済みなら合格", () => {
  const { x1, x2, z, w } = completeInputs();
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.passed, true);
});

test("checkInputCompleteness: X1が1期分しかなければ不合格", () => {
  const { x1, x2, z, w } = completeInputs();
  x1.annualCompletedWorkAmounts = [100_000_000];
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("X1")));
});

test("checkInputCompleteness: X2の自己資本額が未入力なら不合格", () => {
  const { x1, x2, z, w } = completeInputs();
  x2.latestNetAssets = null;
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("X2")));
});

test("checkInputCompleteness: X2の自己資本額が0円なら合格（未入力=null/undefinedとは区別する境界値）", () => {
  const { x1, x2, z, w } = completeInputs();
  x2.latestNetAssets = 0;
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.passed, true);
});

test("checkInputCompleteness: Zの技術職員が0件なら不合格", () => {
  const { x1, x2, z, w } = completeInputs();
  z.technicalStaff = [];
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("Z")));
});

test("checkInputCompleteness: Wの社会保険加入状況が未入力なら不合格", () => {
  const { x1, x2, z, w } = completeInputs();
  w.isSocialInsuranceEnrolled = undefined;
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("W")));
});

test("checkYBunsekiStatus: 結果受領済みなら合格", () => {
  const result = checkYBunsekiStatus("結果受領済み");
  assert.equal(result.passed, true);
});

test("checkYBunsekiStatus: 未申請・申請中はいずれも不合格", () => {
  assert.equal(checkYBunsekiStatus("未申請").passed, false);
  assert.equal(checkYBunsekiStatus("申請中").passed, false);
});
