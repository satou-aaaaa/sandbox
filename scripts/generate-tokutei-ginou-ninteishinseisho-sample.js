import { registerTokuteiGinouModule } from "../src/licenses/tokutei-ginou/index.js";
import { writeNinteiShinseishoDocx } from "../src/licenses/tokutei-ginou/documents/ninteiShinseisho.js";
import { buildSampleTokuteiGinouProfile } from "./sampleTokuteiGinouProfile.js";

registerTokuteiGinouModule();

await writeNinteiShinseishoDocx(buildSampleTokuteiGinouProfile(), "out/tokutei-ginou-ninteishinseisho-sample.docx");

console.log("wrote out/tokutei-ginou-ninteishinseisho-sample.docx");
