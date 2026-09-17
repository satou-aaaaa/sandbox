import { writeDaihyoShainGosenshoDocx } from "../src/incorporation/documents/daihyoShainGosensho.js";
import { buildSampleGodoKaishaCase } from "./sampleIncorporationCase.js";

await writeDaihyoShainGosenshoDocx(buildSampleGodoKaishaCase().teikan, "out/incorporation-daihyoshaingosensho-sample.docx");
console.log("wrote out/incorporation-daihyoshaingosensho-sample.docx");
