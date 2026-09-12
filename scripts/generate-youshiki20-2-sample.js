import { writeYoushiki20_2Docx } from "../src/documents/youshiki20-2.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki20_2Docx(buildSampleApplicantProfile(), "out/youshiki20-2-sample.docx");

console.log("wrote out/youshiki20-2-sample.docx");
