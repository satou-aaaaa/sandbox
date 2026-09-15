import { writeShinseishoDocx } from "../src/licenses/kobutsu/documents/shinseisho.js";
import { buildSampleKobutsuProfile } from "./sampleKobutsuProfile.js";

await writeShinseishoDocx(buildSampleKobutsuProfile(), "out/kobutsu-shinseisho-sample.docx");

console.log("wrote out/kobutsu-shinseisho-sample.docx");
