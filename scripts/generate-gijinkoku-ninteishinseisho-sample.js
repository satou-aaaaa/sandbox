import { writeNinteiShinseishoDocx } from "../src/licenses/gijinkoku/documents/ninteiShinseisho.js";
import { buildSampleGijinkokuProfile } from "./sampleGijinkokuProfile.js";

await writeNinteiShinseishoDocx(buildSampleGijinkokuProfile(), "out/gijinkoku-ninteishinseisho-sample.docx");

console.log("wrote out/gijinkoku-ninteishinseisho-sample.docx");
