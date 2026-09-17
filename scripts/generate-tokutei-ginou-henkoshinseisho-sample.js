import { registerTokuteiGinouModule } from "../src/licenses/tokutei-ginou/index.js";
import { writeHenkoShinseishoDocx } from "../src/licenses/tokutei-ginou/documents/henkoShinseisho.js";
import { buildSampleTokuteiGinouProfile } from "./sampleTokuteiGinouProfile.js";

registerTokuteiGinouModule();

const profile = buildSampleTokuteiGinouProfile();
profile.currentStatusOfResidence = "技能実習";
profile.currentZairyuKikanMatsuIso = "2027-03-31";

await writeHenkoShinseishoDocx(profile, "out/tokutei-ginou-henkoshinseisho-sample.docx");

console.log("wrote out/tokutei-ginou-henkoshinseisho-sample.docx");
