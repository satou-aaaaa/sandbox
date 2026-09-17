import { registerTokuteiGinouModule } from "../src/licenses/tokutei-ginou/index.js";
import { writeChecklistDocx } from "../src/licenses/tokutei-ginou/documents/checklist.js";
import { buildSampleTokuteiGinouProfile } from "./sampleTokuteiGinouProfile.js";

registerTokuteiGinouModule();

await writeChecklistDocx(buildSampleTokuteiGinouProfile().ginouShiken.fieldKey, "out/tokutei-ginou-checklist-sample.docx");

console.log("wrote out/tokutei-ginou-checklist-sample.docx");
