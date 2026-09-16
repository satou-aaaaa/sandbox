import { writeChecklistDocx } from "../src/licenses/minpaku/documents/checklist.js";
import { buildSampleMinpakuProfile } from "./sampleMinpakuProfile.js";

await writeChecklistDocx(buildSampleMinpakuProfile().requiredDocuments, "out/minpaku-checklist-sample.docx");

console.log("wrote out/minpaku-checklist-sample.docx");
