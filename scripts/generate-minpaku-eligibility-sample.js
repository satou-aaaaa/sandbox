import { evaluateMinpakuEligibility, formatMinpakuEligibilityReport } from "../src/licenses/minpaku/eligibility/engine.js";
import { buildSampleMinpakuProfile } from "./sampleMinpakuProfile.js";

const sample = buildSampleMinpakuProfile();
const result = evaluateMinpakuEligibility(sample);
console.log(formatMinpakuEligibilityReport(sample, result));
