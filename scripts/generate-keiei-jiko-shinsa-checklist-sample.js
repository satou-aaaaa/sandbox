import { writeChecklistDocx } from "../src/licenses/keiei-jiko-shinsa/documents/checklist.js";

await writeChecklistDocx("out/keiei-jiko-shinsa-checklist-sample.docx");

console.log("wrote out/keiei-jiko-shinsa-checklist-sample.docx");
