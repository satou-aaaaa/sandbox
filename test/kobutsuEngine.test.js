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

test("evaluateKobutsuEligibility: 法人申請で役員が欠格事由に該当すればeligible=falseになる（古物営業法第4条11号）", () => {
  const profile = buildSampleKobutsuProfile();
  profile.applicantType = "法人";
  profile.officers = [
    {
      name: "役員テスト",
      isUndischargedBankrupt: true,
      hasCriminalRecordWithin5Years: false,
      hasBoryokuFuhouKoiRisk: false,
      hasBoryokudanRelatedOrderWithin3Years: false,
      isAddressUnknown: false,
      hadLicenseRevokedWithin5Years: false,
      hasSurrenderedLicenseDuringRevocationHearingWithin5Years: false,
      hasMentalImpairmentAffectingDuties: false,
    },
  ];
  const result = evaluateKobutsuEligibility(profile);
  assert.equal(result.eligible, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("役員テスト")));
});

test("evaluateKobutsuEligibility: applicantTypeが個人（または未指定）ならofficersが設定されていても無視される", () => {
  const profile = buildSampleKobutsuProfile();
  profile.officers = [
    {
      name: "無視されるはずの役員",
      isUndischargedBankrupt: true,
      hasCriminalRecordWithin5Years: false,
      hasBoryokuFuhouKoiRisk: false,
      hasBoryokudanRelatedOrderWithin3Years: false,
      isAddressUnknown: false,
      hadLicenseRevokedWithin5Years: false,
      hasSurrenderedLicenseDuringRevocationHearingWithin5Years: false,
      hasMentalImpairmentAffectingDuties: false,
    },
  ];
  const result = evaluateKobutsuEligibility(profile);
  assert.equal(result.eligible, true);
});

test("evaluateKobutsuEligibility: 営業所要件を満たさなければeligible=falseになる", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList[0].managerName = "";
  const result = evaluateKobutsuEligibility(profile);
  assert.equal(result.eligible, false);
});

test("formatKobutsuEligibilityReport: 全要件充足なら総合判定が○になり、見出し・各要件セクションの並びが崩れていない", () => {
  const profile = buildSampleKobutsuProfile();
  const result = evaluateKobutsuEligibility(profile);
  const report = formatKobutsuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.match(report, new RegExp(profile.applicantName));
  // 見出し行・総合判定行・各要件セクションが、余計な文言を挟まず
  // それぞれ空行で区切られて並ぶこと（行の追加・削除を検知するため）
  assert.ok(report.includes(`要件判定結果 — ${profile.applicantName}\n\n総合判定: ○ 要件を充足（申請準備を進められます）`));
  assert.ok(report.includes("総合判定: ○ 要件を充足（申請準備を進められます）\n\n## ○ 欠格事由に該当しないこと"));
  assert.ok(report.includes("## ○ 営業所・管理者の要件"));
  assert.ok(!report.includes("未充足の要因まとめ"));
  assert.ok(!report.includes("入力内容の確認事項"));
  assert.ok(report.split("\n").length > 5);
});

test("formatKobutsuEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめの中身が出力される", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isAddressUnknown = true;
  const result = evaluateKobutsuEligibility(profile);
  const report = formatKobutsuEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
  assert.ok(result.blockingIssues.length > 0);
  assert.ok(report.includes(`- ${result.blockingIssues[0]}`));
});

test("formatKobutsuEligibilityReport: consistencyWarningsが未設定でもエラーにならず、入力内容の確認事項セクションは出力されない", () => {
  const profile = buildSampleKobutsuProfile();
  const result = evaluateKobutsuEligibility(profile);
  delete result.consistencyWarnings;
  const report = formatKobutsuEligibilityReport(profile, result);
  assert.ok(!report.includes("入力内容の確認事項"));
});

test("evaluateKobutsuEligibility: 整合性チェックの注記はconsistencyWarningsに含まれ、合否には影響しない", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "2999-01-01"; // 整合性チェックの警告を1件誘発する（合否には無関係）
  const result = evaluateKobutsuEligibility(profile);
  assert.equal(result.eligible, true);
  assert.ok(result.consistencyWarnings.some((w) => w.key === "birthDateInFuture"));
});

test("formatKobutsuEligibilityReport: 整合性チェックの注記があれば「入力内容の確認事項」として、注記の中身が出力される", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "2999-01-01";
  const result = evaluateKobutsuEligibility(profile);
  const report = formatKobutsuEligibilityReport(profile, result);
  assert.match(report, /入力内容の確認事項/);
  assert.ok(result.consistencyWarnings.length > 0);
  assert.ok(report.includes(`- ${result.consistencyWarnings[0].message}`));
});
