import { evaluateInshokutenEligibility, formatInshokutenEligibilityReport } from "../src/licenses/inshokuten-eigyo/eligibility/engine.js";
import { buildSampleInshokutenEigyoProfile } from "./sampleInshokutenEigyoProfile.js";

const sample = buildSampleInshokutenEigyoProfile();
const result = evaluateInshokutenEligibility(sample);
console.log(formatInshokutenEligibilityReport(sample, result));
