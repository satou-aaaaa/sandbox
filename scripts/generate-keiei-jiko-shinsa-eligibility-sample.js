import { evaluateKeieiJikoShinsaReadiness, formatKeieiJikoShinsaReport } from "../src/licenses/keiei-jiko-shinsa/eligibility/engine.js";
import { buildSampleKeieiJikoShinsaProfile, buildSampleClientWithConstruction } from "./sampleKeieiJikoShinsaProfile.js";

const sample = buildSampleKeieiJikoShinsaProfile();
const result = evaluateKeieiJikoShinsaReadiness(sample, buildSampleClientWithConstruction());
console.log(formatKeieiJikoShinsaReport(sample, result));
