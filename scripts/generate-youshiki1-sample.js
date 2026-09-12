import { writeYoushiki1Docx } from "../src/documents/youshiki1.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki1Docx(buildSampleApplicantProfile(), "out/youshiki1-sample.docx");

console.log("wrote out/youshiki1-sample.docx");
