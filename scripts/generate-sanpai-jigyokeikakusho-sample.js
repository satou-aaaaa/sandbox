import { writeJigyokeikakushoDocx } from "../src/licenses/sanpai/documents/jigyokeikakusho.js";
import { buildSampleSanpaiProfile } from "./sampleSanpaiProfile.js";

await writeJigyokeikakushoDocx(buildSampleSanpaiProfile(), "out/sanpai-jigyokeikakusho-sample.docx");

console.log("wrote out/sanpai-jigyokeikakusho-sample.docx");
