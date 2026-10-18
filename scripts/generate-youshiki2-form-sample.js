import { writeYoushiki2FormDocx } from "../src/documents/youshiki2-form.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki2FormDocx(buildSampleApplicantProfile(), "out/youshiki2-form-sample.docx");

console.log("wrote out/youshiki2-form-sample.docx");
