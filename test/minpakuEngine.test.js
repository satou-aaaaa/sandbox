import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMinpakuEligibility, formatMinpakuEligibilityReport } from "../src/licenses/minpaku/eligibility/engine.js";
import { buildSampleMinpakuProfile } from "../scripts/sampleMinpakuProfile.js";

test("evaluateMinpakuEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateMinpakuEligibility(buildSampleMinpakuProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 3);
});

test("evaluateMinpakuEligibility: 欠格事由に該当すればeligible=falseになる", () => {
  const profile = buildSampleMinpakuProfile();
  profile.kekkaku.isBoryokudanRelated = true;
  const result = evaluateMinpakuEligibility(profile);
  assert.equal(result.eligible, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("暴力団")));
});

test("evaluateMinpakuEligibility: 必要書類が未取得ならeligible=falseになる", () => {
  const profile = buildSampleMinpakuProfile();
  profile.requiredDocuments[0].obtained = false;
  const result = evaluateMinpakuEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateMinpakuEligibility: 家主不在型で委託先未確定でも、常にeligible自体には影響しない（警告のみ）", () => {
  const profile = buildSampleMinpakuProfile();
  profile.residentType = "家主不在型";
  profile.managementCompanyName = undefined;
  const result = evaluateMinpakuEligibility(profile);
  assert.equal(result.eligible, true);
  const residentCheck = result.checks.find((c) => c.key === "residentType");
  assert.equal(residentCheck.warnings.length, 1);
});

test("formatMinpakuEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleMinpakuProfile();
  const result = evaluateMinpakuEligibility(profile);
  const report = formatMinpakuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.match(report, new RegExp(profile.applicantName));
});

test("formatMinpakuEligibilityReport: 不合格の要件があれば総合判定が×になる", () => {
  const profile = buildSampleMinpakuProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const result = evaluateMinpakuEligibility(profile);
  const report = formatMinpakuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});
