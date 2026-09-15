import { evaluateKobutsuEligibility, formatKobutsuEligibilityReport } from "../src/licenses/kobutsu/eligibility/engine.js";
import { buildSampleKobutsuProfile } from "./sampleKobutsuProfile.js";

const sample = buildSampleKobutsuProfile();
const result = evaluateKobutsuEligibility(sample);
console.log(formatKobutsuEligibilityReport(sample, result));
