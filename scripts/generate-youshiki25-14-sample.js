import { writeYoushiki25_14Docx } from "../src/documents/youshiki25-14.js";
import { buildSampleApplicantProfile } from "./sampleProfile.js";

await writeYoushiki25_14Docx(buildSampleApplicantProfile(), "out/youshiki25-14-sample.docx");

console.log("wrote out/youshiki25-14-sample.docx");
