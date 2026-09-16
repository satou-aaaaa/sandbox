import { evaluateSanpaiEligibility, formatSanpaiEligibilityReport } from "../src/licenses/sanpai/eligibility/engine.js";
import { buildSampleSanpaiProfile } from "./sampleSanpaiProfile.js";

const sample = buildSampleSanpaiProfile();
const result = evaluateSanpaiEligibility(sample);
console.log(formatSanpaiEligibilityReport(sample, result));
