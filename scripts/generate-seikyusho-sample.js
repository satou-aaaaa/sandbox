import { writeSeikyushoDocx } from "../src/portal/documents/seikyusho.js";
import { buildSamplePartner, buildSampleCase } from "./samplePortalData.js";

await writeSeikyushoDocx(buildSampleCase(), buildSamplePartner(), "out/seikyusho-sample.docx");

console.log("wrote out/seikyusho-sample.docx");
