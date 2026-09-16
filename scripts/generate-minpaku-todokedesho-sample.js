import { writeTodokedeshoDocx } from "../src/licenses/minpaku/documents/todokedesho.js";
import { buildSampleMinpakuProfile } from "./sampleMinpakuProfile.js";

await writeTodokedeshoDocx(buildSampleMinpakuProfile(), "out/minpaku-todokedesho-sample.docx");

console.log("wrote out/minpaku-todokedesho-sample.docx");
