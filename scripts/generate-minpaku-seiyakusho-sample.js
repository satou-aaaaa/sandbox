import { writeSeiyakushoDocx } from "../src/licenses/minpaku/documents/seiyakusho.js";
import { buildSampleMinpakuProfile } from "./sampleMinpakuProfile.js";

await writeSeiyakushoDocx(buildSampleMinpakuProfile(), "out/minpaku-seiyakusho-sample.docx");

console.log("wrote out/minpaku-seiyakusho-sample.docx");
