import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateNouchiTenyoEligibility, formatNouchiTenyoEligibilityReport } from "../src/licenses/nouchi-tenyo/eligibility/engine.js";
import { buildSampleNouchiTenyoProfile } from "../scripts/sampleNouchiTenyoProfile.js";

test("evaluateNouchiTenyoEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateNouchiTenyoEligibility(buildSampleNouchiTenyoProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.checks.length, 2);
});

test("evaluateNouchiTenyoEligibility: 立地基準を満たさなければeligible=falseになる", () => {
  const profile = buildSampleNouchiTenyoProfile();
  profile.ricchiKijun = { nouchiKubun: "農用地区域内農地" };
  const result = evaluateNouchiTenyoEligibility(profile);
  assert.equal(result.eligible, false);
});

test("formatNouchiTenyoEligibilityReport: 一次スクリーニングである旨の注記を含む", () => {
  const profile = buildSampleNouchiTenyoProfile();
  const result = evaluateNouchiTenyoEligibility(profile);
  const report = formatNouchiTenyoEligibilityReport(profile, result);
  assert.match(report, /農業委員会・都道府県が行います/);
});

test("formatNouchiTenyoEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleNouchiTenyoProfile();
  const result = evaluateNouchiTenyoEligibility(profile);
  const report = formatNouchiTenyoEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
});

test("formatNouchiTenyoEligibilityReport: 不合格の要件があれば総合判定が×になり未充足の要因まとめが出力される", () => {
  const profile = buildSampleNouchiTenyoProfile();
  profile.ippanKijun.hasSufficientFundsAndCredit = false;
  const result = evaluateNouchiTenyoEligibility(profile);
  const report = formatNouchiTenyoEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});
