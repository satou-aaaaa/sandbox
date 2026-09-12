import { writeYoushiki16Docx } from "../src/documents/youshiki16.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki16Docx(buildSampleApplicantProfile(), "out/youshiki16-sample.docx");

console.log("wrote out/youshiki16-sample.docx");
