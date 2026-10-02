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

test("formatMinpakuEligibilityReport: 全要件充足なら総合判定が○になり、見出し・各要件セクションの並びが崩れていない", () => {
  const profile = buildSampleMinpakuProfile();
  const result = evaluateMinpakuEligibility(profile);
  const report = formatMinpakuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.match(report, new RegExp(profile.applicantName));
  // 見出し行・総合判定行・各要件セクションが、余計な文言を挟まず
  // それぞれ空行で区切られて並ぶこと（行の追加・削除を検知するため）
  assert.ok(
    report.includes(`準備状況確認結果 — ${profile.applicantName}\n\n総合判定: ○ 準備が整っています（届出準備を進められます）`)
  );
  assert.ok(report.includes("総合判定: ○ 準備が整っています（届出準備を進められます）\n\n## ○ 欠格事由に該当しないこと"));
  assert.ok(report.includes("## ○ 必要書類の充足確認"));
  assert.ok(!report.includes("未充足の要因まとめ"));
  assert.ok(report.split("\n").length > 5);
});

test("formatMinpakuEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめの中身が出力される", () => {
  const profile = buildSampleMinpakuProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const result = evaluateMinpakuEligibility(profile);
  const report = formatMinpakuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
  assert.ok(result.blockingIssues.length > 0);
  assert.ok(report.includes(`- ${result.blockingIssues[0]}`));
});
