import { writeSeiyakushoDocx } from "../src/licenses/kobutsu/documents/seiyakusho.js";
import { buildSampleKobutsuProfile } from "./sampleKobutsuProfile.js";

await writeSeiyakushoDocx(buildSampleKobutsuProfile(), "out/kobutsu-seiyakusho-sample.docx");

console.log("wrote out/kobutsu-seiyakusho-sample.docx");
