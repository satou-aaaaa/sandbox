import { writeChecklistDocx } from "../src/licenses/gijinkoku/documents/checklist.js";
import { buildSampleGijinkokuProfile } from "./sampleGijinkokuProfile.js";

await writeChecklistDocx(buildSampleGijinkokuProfile().companyCategory, "out/gijinkoku-checklist-sample.docx");

console.log("wrote out/gijinkoku-checklist-sample.docx");
