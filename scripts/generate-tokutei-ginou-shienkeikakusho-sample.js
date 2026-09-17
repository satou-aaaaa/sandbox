import { writeShienKeikakushoDocx } from "../src/licenses/tokutei-ginou/documents/shienKeikakusho.js";
import { buildSampleTokuteiGinouProfile } from "./sampleTokuteiGinouProfile.js";

await writeShienKeikakushoDocx(buildSampleTokuteiGinouProfile().shienTaisei, "out/tokutei-ginou-shienkeikakusho-sample.docx");

console.log("wrote out/tokutei-ginou-shienkeikakusho-sample.docx");
