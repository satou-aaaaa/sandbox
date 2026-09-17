import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTokuteiGinouEligibility, formatTokuteiGinouEligibilityReport } from "../src/licenses/tokutei-ginou/eligibility/engine.js";
import { TOKUTEI_GINOU_SCREENING_NOTICE } from "../src/licenses/tokutei-ginou/eligibility/disclaimer.js";
import { clearFields } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";
import { seedFieldRegistry } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.seed.js";
import { buildSampleTokuteiGinouProfile } from "../scripts/sampleTokuteiGinouProfile.js";

test("evaluateTokuteiGinouEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  clearFields();
  seedFieldRegistry();
  const result = evaluateTokuteiGinouEligibility(buildSampleTokuteiGinouProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 4);
});

test("evaluateTokuteiGinouEligibility: 技能水準要件を満たさなければeligible=falseになる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.ginouShiken.hasPassedSkillTest = false;
  const result = evaluateTokuteiGinouEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateTokuteiGinouEligibility: 日本語能力水準要件を満たさなければeligible=falseになる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.nihongoNouryoku.hasJlptN4OrAbove = false;
  const result = evaluateTokuteiGinouEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateTokuteiGinouEligibility: 特定技能所属機関の基準を満たさなければeligible=falseになる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.shozokuKikanKijun.offeredSalaryAnnual = 1;
  const result = evaluateTokuteiGinouEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateTokuteiGinouEligibility: 支援体制要件を満たさなければeligible=falseになる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.shienTaisei.hasShienSekininsha = false;
  const result = evaluateTokuteiGinouEligibility(profile);
  assert.equal(result.eligible, false);
});

test("formatTokuteiGinouEligibilityReport: 一次スクリーニング強調文言が冒頭・末尾の両方に含まれる（NFR-T2）", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  const result = evaluateTokuteiGinouEligibility(profile);
  const report = formatTokuteiGinouEligibilityReport(profile, result);
  const firstIndex = report.indexOf(TOKUTEI_GINOU_SCREENING_NOTICE);
  const lastIndex = report.lastIndexOf(TOKUTEI_GINOU_SCREENING_NOTICE);
  assert.ok(firstIndex >= 0);
  assert.ok(lastIndex > firstIndex);
});

test("formatTokuteiGinouEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  const result = evaluateTokuteiGinouEligibility(profile);
  const report = formatTokuteiGinouEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
});

test("formatTokuteiGinouEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.ginouShiken.hasPassedSkillTest = false;
  const result = evaluateTokuteiGinouEligibility(profile);
  const report = formatTokuteiGinouEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});

test("evaluateTokuteiGinouEligibility: 技能実習2号経由（試験免除ケース）でも正しく判定できる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.ginouShiken.hasPassedSkillTest = false;
  profile.ginouShiken.hasCompletedGinouJisshu2GoWell = true;
  profile.ginouShiken.isSameWorkCategoryAsGinouJisshu = true;
  profile.nihongoNouryoku.hasJlptN4OrAbove = false;
  profile.nihongoNouryoku.isExemptByGinouJisshu2Go = true;
  const result = evaluateTokuteiGinouEligibility(profile);
  assert.equal(result.eligible, true);
});
