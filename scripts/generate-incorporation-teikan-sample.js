import { writeTeikanSummaryDocx } from "../src/incorporation/documents/teikanSummary.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "./sampleIncorporationCase.js";

await writeTeikanSummaryDocx(buildSampleKabushikiKaishaCase().teikan, "out/incorporation-teikan-kabu-sample.docx");
console.log("wrote out/incorporation-teikan-kabu-sample.docx");

await writeTeikanSummaryDocx(buildSampleGodoKaishaCase().teikan, "out/incorporation-teikan-godo-sample.docx");
console.log("wrote out/incorporation-teikan-godo-sample.docx");
