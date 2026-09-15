import { writeRirekishoDocx } from "../src/licenses/kobutsu/documents/rirekisho.js";
import { buildSampleKobutsuProfile } from "./sampleKobutsuProfile.js";

const sample = buildSampleKobutsuProfile();
sample.representativeHistory = "2015年4月 サンプル商事株式会社 入社\n2020年3月 同社退社、独立開業準備";

await writeRirekishoDocx(sample, "out/kobutsu-rirekisho-sample.docx");

console.log("wrote out/kobutsu-rirekisho-sample.docx");
