import { evaluateNouchiTenyoEligibility, formatNouchiTenyoEligibilityReport } from "../src/licenses/nouchi-tenyo/eligibility/engine.js";
import { buildSampleNouchiTenyoProfile } from "./sampleNouchiTenyoProfile.js";

const sample = buildSampleNouchiTenyoProfile();
const result = evaluateNouchiTenyoEligibility(sample);
console.log(formatNouchiTenyoEligibilityReport(sample, result));
