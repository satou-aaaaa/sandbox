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

test("TOKUTEI_GINOU_SCREENING_NOTICE: 一次スクリーニング強調文言の全文が欠落・改変されていない", () => {
  // report内でのindexOf検証（下記テスト）は同じ定数同士の比較のため、
  // 定数自体の一部の文が空文字列等に化けても検出できない
  // （ミューテーションテストで発見。CHANGELOG.md参照）。
  assert.equal(
    TOKUTEI_GINOU_SCREENING_NOTICE,
    "※ この判定は書類準備段階での一次スクリーニングに過ぎません。特定技能の該当性は、" +
      "出入国在留管理局及び分野所管省庁が個別の事案ごとに審査し、本判定と異なる結果になることが" +
      "十分にあります。分野別運用方針・技能評価試験の実施状況は改定頻度が高いため、申請直前に" +
      "必ず出入国在留管理庁公式サイトで最新情報を確認してください。この結果を外国人本人・" +
      "特定技能所属機関への在留資格取得の確約として提示しないこと。"
  );
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
