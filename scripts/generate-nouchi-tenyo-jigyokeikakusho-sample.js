import { writeJigyokeikakushoDocx } from "../src/licenses/nouchi-tenyo/documents/jigyokeikakusho.js";
import { buildSampleNouchiTenyoProfile } from "./sampleNouchiTenyoProfile.js";

await writeJigyokeikakushoDocx(buildSampleNouchiTenyoProfile(), "out/nouchi-tenyo-jigyokeikakusho-sample.docx");

console.log("wrote out/nouchi-tenyo-jigyokeikakusho-sample.docx");
