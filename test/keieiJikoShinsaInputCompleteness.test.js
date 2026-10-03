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

test("checkInputCompleteness: 合格時のkey・label・warnings・reasonsを厳密に確認", () => {
  const { x1, x2, z, w } = completeInputs();
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.equal(result.key, "inputCompleteness");
  assert.equal(result.label, "評価項目データの入力完備性");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reasons, ["X1・X2・Z・Wの入力データは、申請に必要な形式を満たしています（点数評価は行っていません）。"]);
});

test("checkInputCompleteness: 不合格時は合格メッセージを含まない（X1不足の例）", () => {
  const { x1, x2, z, w } = completeInputs();
  x1.annualCompletedWorkAmounts = [100_000_000];
  const result = checkInputCompleteness(x1, x2, z, w);
  assert.deepEqual(result.reasons, ["X1（完成工事高）: 直前2期分以上の完成工事高が入力されていません。"]);
});

test("checkYBunsekiStatus: 結果受領済みなら合格", () => {
  const result = checkYBunsekiStatus("結果受領済み");
  assert.equal(result.passed, true);
});

test("checkYBunsekiStatus: 未申請・申請中はいずれも不合格", () => {
  assert.equal(checkYBunsekiStatus("未申請").passed, false);
  assert.equal(checkYBunsekiStatus("申請中").passed, false);
});

test("checkYBunsekiStatus: 結果受領済みの場合のkey・label・warnings・reasonsを厳密に確認", () => {
  const result = checkYBunsekiStatus("結果受領済み");
  assert.equal(result.key, "yBunsekiStatus");
  assert.equal(result.label, "経営状況分析（Y）の申請状況");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reasons, ["経営状況分析（Y）の結果を登録経営状況分析機関から受領済みです。"]);
});

test("checkYBunsekiStatus: 未申請の場合のreasonsにステータス名を含めて厳密に確認", () => {
  const result = checkYBunsekiStatus("未申請");
  assert.deepEqual(result.reasons, [
    "Y（経営状況分析）は現在「未申請」です。経営規模等評価申請にはYの分析結果が必要なため、早めに登録経営状況分析機関へ申請してください。",
  ]);
});
