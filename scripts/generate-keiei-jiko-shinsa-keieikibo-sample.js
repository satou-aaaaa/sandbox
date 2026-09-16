import { writeKeieikiboHyoukaDocx } from "../src/licenses/keiei-jiko-shinsa/documents/keieikiboHyouka.js";
import { buildSampleKeieiJikoShinsaProfile } from "./sampleKeieiJikoShinsaProfile.js";

await writeKeieikiboHyoukaDocx(buildSampleKeieiJikoShinsaProfile(), "out/keiei-jiko-shinsa-keieikibo-sample.docx");

console.log("wrote out/keiei-jiko-shinsa-keieikibo-sample.docx");
