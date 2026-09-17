import { writeHenkoShinseishoDocx } from "../src/licenses/gijinkoku/documents/henkoShinseisho.js";
import { buildSampleGijinkokuProfile } from "./sampleGijinkokuProfile.js";

const profile = buildSampleGijinkokuProfile();
profile.currentStatusOfResidence = "留学";
profile.currentZairyuKikanMatsuIso = "2027-03-31";

await writeHenkoShinseishoDocx(profile, "out/gijinkoku-henkoshinseisho-sample.docx");

console.log("wrote out/gijinkoku-henkoshinseisho-sample.docx");
