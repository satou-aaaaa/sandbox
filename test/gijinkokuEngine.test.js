import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateGijinkokuEligibility, formatGijinkokuEligibilityReport } from "../src/licenses/gijinkoku/eligibility/engine.js";
import { GIJINKOKU_SCREENING_NOTICE } from "../src/licenses/gijinkoku/eligibility/disclaimer.js";
import { buildSampleGijinkokuProfile } from "../scripts/sampleGijinkokuProfile.js";

test("evaluateGijinkokuEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateGijinkokuEligibility(buildSampleGijinkokuProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 3);
});

test("evaluateGijinkokuEligibility: 学歴・実務経験要件を満たさなければeligible=falseになる", () => {
  const profile = buildSampleGijinkokuProfile();
  profile.gakureki.educationLevel = "それ以外";
  const result = evaluateGijinkokuEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateGijinkokuEligibility: 報酬要件を満たさなければeligible=falseになる", () => {
  const profile = buildSampleGijinkokuProfile();
  profile.hoshu.offeredSalaryAnnual = 1;
  const result = evaluateGijinkokuEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateGijinkokuEligibility: 専攻・職務関連性は常に合否に影響しない（警告のみ）", () => {
  const profile = buildSampleGijinkokuProfile();
  const result = evaluateGijinkokuEligibility(profile);
  const kanrenseiCheck = result.checks.find((c) => c.key === "kanrensei");
  assert.equal(kanrenseiCheck.passed, true);
  assert.equal(kanrenseiCheck.warnings.length, 1);
});

test("GIJINKOKU_SCREENING_NOTICE: 一次スクリーニング強調文言の全文が欠落・改変されていない", () => {
  // report内でのindexOf検証（下記テスト）は同じ定数同士の比較のため、
  // 定数自体の一部の文が空文字列等に化けても検出できない
  // （ミューテーションテストで発見。CHANGELOG.md参照）。
  // 定数の全文を直接アサートすることで、この種の改変を検出できるようにする。
  assert.equal(
    GIJINKOKU_SCREENING_NOTICE,
    "※ この判定は書類準備段階での一次スクリーニングに過ぎません。" +
      "在留資格の該当性は、出入国在留管理局が個別の事案ごとに審査し、" +
      "本判定と異なる結果になることが十分にあります。また、この結果を" +
      "外国人本人・所属機関への在留資格取得の確約として提示しないこと。"
  );
});

test("formatGijinkokuEligibilityReport: 一次スクリーニング強調文言が冒頭・末尾の両方に含まれる（NFR-G2）", () => {
  const profile = buildSampleGijinkokuProfile();
  const result = evaluateGijinkokuEligibility(profile);
  const report = formatGijinkokuEligibilityReport(profile, result);
  const firstIndex = report.indexOf(GIJINKOKU_SCREENING_NOTICE);
  const lastIndex = report.lastIndexOf(GIJINKOKU_SCREENING_NOTICE);
  assert.ok(firstIndex >= 0);
  assert.ok(lastIndex > firstIndex);
});

test("formatGijinkokuEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleGijinkokuProfile();
  const result = evaluateGijinkokuEligibility(profile);
  const report = formatGijinkokuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
});

test("formatGijinkokuEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  const profile = buildSampleGijinkokuProfile();
  profile.hoshu.offeredSalaryAnnual = 1;
  const result = evaluateGijinkokuEligibility(profile);
  const report = formatGijinkokuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});
