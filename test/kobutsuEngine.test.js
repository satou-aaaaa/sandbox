import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateKobutsuEligibility, formatKobutsuEligibilityReport } from "../src/licenses/kobutsu/eligibility/engine.js";
import { buildSampleKobutsuProfile } from "../scripts/sampleKobutsuProfile.js";

test("evaluateKobutsuEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateKobutsuEligibility(buildSampleKobutsuProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 2);
});

test("evaluateKobutsuEligibility: 欠格事由に該当すればeligible=falseになる", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const result = evaluateKobutsuEligibility(profile);
  assert.equal(result.eligible, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("破産")));
});

test("evaluateKobutsuEligibility: 営業所要件を満たさなければeligible=falseになる", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList[0].managerName = "";
  const result = evaluateKobutsuEligibility(profile);
  assert.equal(result.eligible, false);
});

test("formatKobutsuEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleKobutsuProfile();
  const result = evaluateKobutsuEligibility(profile);
  const report = formatKobutsuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.match(report, new RegExp(profile.applicantName));
  assert.ok(!report.includes("未充足の要因まとめ"));
});

test("formatKobutsuEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isAddressUnknown = true;
  const result = evaluateKobutsuEligibility(profile);
  const report = formatKobutsuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});
