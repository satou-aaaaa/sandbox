import { evaluateEligibility, formatEligibilityReport } from "../src/eligibility/engine.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

const sample = buildSampleApplicantProfile();
const result = evaluateEligibility(sample);
console.log(formatEligibilityReport(sample, result));
