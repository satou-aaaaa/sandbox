import { writeYoushiki8Docx } from "../src/documents/youshiki8.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki8Docx(buildSampleApplicantProfile(), "out/youshiki8-sample.docx");

console.log("wrote out/youshiki8-sample.docx");
