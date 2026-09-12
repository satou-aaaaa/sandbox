import { writeYoushiki2Docx } from "../src/documents/youshiki2.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki2Docx(buildSampleApplicantProfile(), "out/youshiki2-sample.docx");

console.log("wrote out/youshiki2-sample.docx");
