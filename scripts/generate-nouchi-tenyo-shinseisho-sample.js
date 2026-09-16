import { writeShinseishoDocx } from "../src/licenses/nouchi-tenyo/documents/shinseisho.js";
import { buildSampleNouchiTenyoProfile } from "./sampleNouchiTenyoProfile.js";

await writeShinseishoDocx(buildSampleNouchiTenyoProfile(), "out/nouchi-tenyo-shinseisho-sample.docx");

console.log("wrote out/nouchi-tenyo-shinseisho-sample.docx");
