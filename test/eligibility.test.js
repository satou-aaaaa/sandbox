import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility } from "../src/eligibility/engine.js";

/** @returns {import('../src/eligibility/types.js').ApplicantProfile} */
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
