import { writeYoushiki7Docx } from "../src/documents/youshiki7.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki7Docx(buildSampleApplicantProfile(), "out/youshiki7-sample.docx");

console.log("wrote out/youshiki7-sample.docx");
