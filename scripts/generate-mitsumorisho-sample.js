import { writeMitsumorishoDocx } from "../src/portal/documents/mitsumorisho.js";
import { buildSamplePartner, buildSampleCase } from "./samplePortalData.js";

await writeMitsumorishoDocx(buildSampleCase(), buildSamplePartner(), "out/mitsumorisho-sample.docx");

console.log("wrote out/mitsumorisho-sample.docx");
