import { registerTokuteiGinouModule } from "../src/licenses/tokutei-ginou/index.js";
import { evaluateTokuteiGinouEligibility, formatTokuteiGinouEligibilityReport } from "../src/licenses/tokutei-ginou/eligibility/engine.js";
import { buildSampleTokuteiGinouProfile } from "./sampleTokuteiGinouProfile.js";

registerTokuteiGinouModule();

const sample = buildSampleTokuteiGinouProfile();
const result = evaluateTokuteiGinouEligibility(sample);
console.log(formatTokuteiGinouEligibilityReport(sample, result));
