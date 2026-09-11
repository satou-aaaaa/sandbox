import { evaluateEligibility, formatEligibilityReport } from "../src/eligibility/engine.js";

/** @type {import('../src/eligibility/types.js').ApplicantProfile} */
const sample = {
  applicantName: "サンプル建設株式会社",
  keieiGyomuKanri: {
    yearsAsResponsibleOfficer: 6,
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

const result = evaluateEligibility(sample);
console.log(formatEligibilityReport(sample, result));
