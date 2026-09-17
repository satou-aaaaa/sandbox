import { calcLegalHeirs } from "../src/succession/heirs/calcLegalHeirs.js";
import { writeZaisanMokurokuDocx } from "../src/succession/documents/zaisanMokuroku.js";
import { writeIsanBunkatsuKyogishoDocx } from "../src/succession/documents/isanBunkatsuKyogisho.js";
import { writeJihitsushoshoYuigonDocx } from "../src/succession/documents/jihitsushoshoYuigon.js";
import { writeHouteiSouzokuJohoIchiranzuDocx } from "../src/succession/documents/houteiSouzokuJohoIchiranzu.js";
import { buildSampleSuccessionCase } from "./sampleSuccessionCase.js";

const sample = buildSampleSuccessionCase();
const heirsResult = calcLegalHeirs(sample.familyStructure);
const properties = sample.properties ?? [];

await writeZaisanMokurokuDocx(properties, "out/succession-zaisan-mokuroku-sample.docx");
console.log("wrote out/succession-zaisan-mokuroku-sample.docx");

await writeIsanBunkatsuKyogishoDocx(heirsResult, properties, sample, "out/succession-isan-bunkatsu-kyogisho-sample.docx");
console.log("wrote out/succession-isan-bunkatsu-kyogisho-sample.docx");

await writeJihitsushoshoYuigonDocx(heirsResult, properties, "out/succession-jihitsushosho-yuigon-sample.docx", {
  executorName: "サンプル 太郎",
});
console.log("wrote out/succession-jihitsushosho-yuigon-sample.docx（遺言執行者指定あり）");

await writeHouteiSouzokuJohoIchiranzuDocx(sample.familyStructure, heirsResult, "out/succession-houtei-souzoku-joho-ichiranzu-sample.docx");
console.log("wrote out/succession-houtei-souzoku-joho-ichiranzu-sample.docx");
