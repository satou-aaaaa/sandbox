import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSanpaiEligibility, formatSanpaiEligibilityReport } from "../src/licenses/sanpai/eligibility/engine.js";
import { buildSampleSanpaiProfile } from "../scripts/sampleSanpaiProfile.js";

test("evaluateSanpaiEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateSanpaiEligibility(buildSampleSanpaiProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 4);
});

test("evaluateSanpaiEligibility: 欠格事由に該当すればeligible=falseになる", () => {
  const profile = buildSampleSanpaiProfile();
  profile.kekkaku.isBoryokudanRelated = true;
  const result = evaluateSanpaiEligibility(profile);
  assert.equal(result.eligible, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("暴力団")));
});

test("evaluateSanpaiEligibility: 講習修了証が期限切れならeligible=falseになる", () => {
  const profile = buildSampleSanpaiProfile();
  profile.koushu.completionDateIso = "2015-04-01";
  const result = evaluateSanpaiEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateSanpaiEligibility: 経理的基礎（債務超過）に該当してもeligible=falseになる", () => {
  const profile = buildSampleSanpaiProfile();
  profile.keiriKiso.latestNetAssets = -1;
  const result = evaluateSanpaiEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateSanpaiEligibility: 運搬施設の防止措置がなければeligible=falseになる", () => {
  const profile = buildSampleSanpaiProfile();
  profile.hasOdorSpillPreventionMeasures = false;
  const result = evaluateSanpaiEligibility(profile);
  assert.equal(result.eligible, false);
});

test("formatSanpaiEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleSanpaiProfile();
  const result = evaluateSanpaiEligibility(profile);
  const report = formatSanpaiEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.match(report, new RegExp(profile.applicantName));
  assert.ok(!report.includes("未充足の要因まとめ"));
});

test("formatSanpaiEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  const profile = buildSampleSanpaiProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const result = evaluateSanpaiEligibility(profile);
  const report = formatSanpaiEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});
