import { writeShinseishoDocx } from "../src/licenses/sanpai/documents/shinseisho.js";
import { buildSampleSanpaiProfile } from "./sampleSanpaiProfile.js";

await writeShinseishoDocx(buildSampleSanpaiProfile(), "out/sanpai-shinseisho-sample.docx");

console.log("wrote out/sanpai-shinseisho-sample.docx");
