import { writeShinseishoSummaryDocx } from "../src/licenses/inshokuten-eigyo/documents/shinseishoSummary.js";
import { buildSampleInshokutenEigyoProfile } from "./sampleInshokutenEigyoProfile.js";

await writeShinseishoSummaryDocx(buildSampleInshokutenEigyoProfile(), "out/inshokuten-eigyo-shinseisho-sample.docx");

console.log("wrote out/inshokuten-eigyo-shinseisho-sample.docx");
