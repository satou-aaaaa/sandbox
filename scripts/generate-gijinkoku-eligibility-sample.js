import { evaluateGijinkokuEligibility, formatGijinkokuEligibilityReport } from "../src/licenses/gijinkoku/eligibility/engine.js";
import { buildSampleGijinkokuProfile } from "./sampleGijinkokuProfile.js";

const sample = buildSampleGijinkokuProfile();
const result = evaluateGijinkokuEligibility(sample);
console.log(formatGijinkokuEligibilityReport(sample, result));
