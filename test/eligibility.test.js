import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility, formatEligibilityReport } from "../src/licenses/construction/eligibility/engine.js";

/** @returns {import('../src/licenses/construction/eligibility/types.js').ApplicantProfile} */
function baseProfile() {
  return {
    applicantName: "テスト建設株式会社",
    keieiGyomuKanri: {
      yearsAsResponsibleOfficer: 5,
      yearsAsQuasiResponsibleOfficer: 0,
      yearsAsAssistant: 0,
      isOfficerFor2Years: false,
      assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
      hasSocialInsurance: true,
    },
    senninGijutsushaList: [
      {
        officeName: "本店",
        licenseType: "一般",
        hasNationalLicense: true,
        isDesignatedCourseGraduate: false,
        educationLevel: null,
        yearsOfPracticalExperience: 0,
        yearsOfGeneralExperience: 0,
        yearsOfSupervisoryExperience: 0,
      },
    ],
    zaisanKiso: {
      licenseType: "一般",
      netAssets: 6_000_000,
      fundingCapacity: 0,
      hasFiveYearsContinuousOperation: false,
      capitalAmount: 0,
      deficitRatio: 0,
      currentRatio: 0,
    },
    kekkaku: {
      isUndischargedBankrupt: false,
      hadLicenseRevokedWithin5Years: false,
      hasCriminalRecordWithin5Years: false,
      isBoryokudanMemberOrWithin5Years: false,
      hasMentalImpairmentAffectingDuties: false,
      hasFalseOrOmittedStatement: false,
    },
    seijitsusei: { hasNoDishonestActRisk: true },
  };
}

test("全要件を満たす標準ケースは eligible = true", () => {
  const result = evaluateEligibility(baseProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 5);
});

test("経営業務管理体制: 社会保険未加入なら不合格", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri.hasSocialInsurance = false;
  const result = evaluateEligibility(profile);
  assert.equal(result.eligible, false);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, false);
});

test("経営業務管理体制: ルートD（複合要件）でも合格できる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: true,
    assistantSupportYears: { finance: 5, labor: 5, operations: 5 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true);
});

test("専任技術者: 実務経験10年ルートで合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
});

test("専任技術者: 特定建設業でも指導監督的実務経験2年以上あれば合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 2,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
});

test("専任技術者: 特定建設業は指導監督的実務経験2年も必要", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 1, // 2年未満
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
});

test("財産的基礎: 特定建設業は3条件すべて必要", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 45_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 25_000_000,
    deficitRatio: 10,
    currentRatio: 60, // 75%未満で不合格
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
});

test("欠格要件: 暴力団関係者は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.isBoryokudanMemberOrWithin5Years = true;
  const result = evaluateEligibility(profile);
  assert.equal(result.eligible, false);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("暴力団")));
});

test("誠実性: 自己申告で懸念ありなら不合格", () => {
  const profile = baseProfile();
  profile.seijitsusei = { hasNoDishonestActRisk: false, notes: "過去に指名停止歴あり、要確認" };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.equal(check.passed, false);
});

test("誠実性: 申告メモがあれば判定理由に含まれる", () => {
  const profile = baseProfile();
  profile.seijitsusei = { hasNoDishonestActRisk: true, notes: "特記事項なし" };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.ok(check.reasons.some((r) => r.includes("特記事項なし")));
});

test("誠実性: 合格時も行政書士本人による個別確認を促す警告が必ず表示される", () => {
  const profile = baseProfile();
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.equal(check.passed, true);
  assert.ok(check.warnings.length > 0);
});

test("財産的基礎: 一般建設業は自己資本500万円ちょうどで要件を満たす（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 5_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
});

test("財産的基礎: 一般建設業は自己資本499万9999円では単独では要件を満たさない（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 4_999_999,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
});

test("財産的基礎: 一般建設業は資金調達能力500万円以上のみでも要件を満たす", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 5_000_000,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
});

test("財産的基礎: 一般建設業は直近5年間の継続営業実績のみでも要件を満たす", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: true,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
});

test("専任技術者: 国家資格保有のみでも合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
});

test("専任技術者: 指定学科卒業（高卒）+ 実務経験5年で合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "高卒",
      yearsOfPracticalExperience: 5,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
});

test("専任技術者: 指定学科卒業（高卒）でも実務経験4年では合格できない（境界値）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "高卒",
      yearsOfPracticalExperience: 4,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
});

test("専任技術者: 指定学科卒業（大卒）+ 実務経験3年で合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "大卒",
      yearsOfPracticalExperience: 3,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
});

test("専任技術者: 複数営業所のうち1つでも不合格なら全体が不合格になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "支店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("[支店]")));
});

test("専任技術者: 営業所が1つも登録されていなければ不合格になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("営業所の情報が入力されていません")));
});

test("経営業務管理体制: ルートB（準ずる地位5年）でも合格できる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 5,
    yearsAsAssistant: 0,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true);
});

test("経営業務管理体制: ルートC（補佐業務6年）でも合格できる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 6,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true);
});

test("経営業務管理体制: 補佐業務5年（6年未満）ではルートC不成立（境界値）", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 5,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, false);
});

test("欠格要件: 破産者で復権を得ていない場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("破産者")));
});

test("欠格要件: 5年以内に建設業許可を取り消された経験がある場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hadLicenseRevokedWithin5Years = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("許可を取り消された")));
});

test("欠格要件: 禁錮以上の刑等から5年を経過していない場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hasCriminalRecordWithin5Years = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("禁錮以上の刑")));
});

test("欠格要件: 心身の故障により適正に営むことができないと認められる場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hasMentalImpairmentAffectingDuties = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("心身の故障")));
});

test("欠格要件: 虚偽記載・重要事実の記載漏れがある場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hasFalseOrOmittedStatement = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("虚偽の記載")));
});

test("formatEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = baseProfile();
  const result = evaluateEligibility(profile);
  const report = formatEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.ok(!report.includes("未充足の要因まとめ"));
});

test("formatEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  const profile = baseProfile();
  profile.kekkaku.isBoryokudanMemberOrWithin5Years = true;
  const result = evaluateEligibility(profile);
  const report = formatEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
  assert.match(report, /暴力団/);
});

test("formatEligibilityReport: 入力内容の整合性チェックで警告があれば確認事項として出力される（合否には影響しない）", () => {
  const profile = baseProfile();
  profile.representativeName = "山田 太郎";
  profile.keieiGyomuKanri.responsibleName = "鈴木 次郎"; // 代表者氏名と不一致（FR-6.1）
  const result = evaluateEligibility(profile);
  const report = formatEligibilityReport(profile, result);
  assert.equal(result.eligible, true); // 整合性チェックの警告は合否に影響しない
  assert.match(report, /総合判定: ○/);
  assert.match(report, /入力内容の確認事項/);
  assert.match(report, /山田 太郎/);
});
