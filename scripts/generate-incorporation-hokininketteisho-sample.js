import { writeHokininKetteishoDocx } from "../src/incorporation/documents/hokininKetteisho.js";
import { buildSampleKabushikiKaishaCase } from "./sampleIncorporationCase.js";

const decisions = { honTenShozaiChi: "東京都サンプル区1丁目2番3号", daihyoTorishimariyaku: "サンプル太郎" };

await writeHokininKetteishoDocx(buildSampleKabushikiKaishaCase().teikan, decisions, "out/incorporation-hokininketteisho-sample.docx");
console.log("wrote out/incorporation-hokininketteisho-sample.docx");
