import { writeYoushiki6Docx } from "../src/documents/youshiki6.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki6Docx(buildSampleApplicantProfile(), "out/youshiki6-sample.docx");

console.log("wrote out/youshiki6-sample.docx");
