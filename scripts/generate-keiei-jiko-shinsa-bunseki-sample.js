import { writeKeieijoukyouBunsekiDocx } from "../src/licenses/keiei-jiko-shinsa/documents/keieijoukyouBunseki.js";
import { buildSampleKeieiJikoShinsaProfile } from "./sampleKeieiJikoShinsaProfile.js";

await writeKeieijoukyouBunsekiDocx(buildSampleKeieiJikoShinsaProfile(), "out/keiei-jiko-shinsa-bunseki-sample.docx");

console.log("wrote out/keiei-jiko-shinsa-bunseki-sample.docx");
