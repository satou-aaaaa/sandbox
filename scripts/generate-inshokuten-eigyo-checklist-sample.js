import { writeTenpuChecklistDocx } from "../src/licenses/inshokuten-eigyo/documents/tenpuChecklist.js";
import { buildSampleInshokutenEigyoProfile } from "./sampleInshokutenEigyoProfile.js";

await writeTenpuChecklistDocx(buildSampleInshokutenEigyoProfile().shisetsu, "out/inshokuten-eigyo-checklist-sample.docx");

console.log("wrote out/inshokuten-eigyo-checklist-sample.docx");
