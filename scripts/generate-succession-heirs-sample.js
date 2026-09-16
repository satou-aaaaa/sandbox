import { calcLegalHeirs } from "../src/succession/heirs/calcLegalHeirs.js";
import { buildSampleSuccessionCase } from "./sampleSuccessionCase.js";

const sample = buildSampleSuccessionCase();
const result = calcLegalHeirs(sample.familyStructure);
console.log(`# 法定相続人・法定相続分の試算 — ${sample.caseLabel}`, "\n");
console.log(`パターン: ${result.pattern}`, "\n");
for (const heir of result.heirs) {
  console.log(`- ${heir.label ?? heir.personId}（${heir.relation}）: ${heir.shareFraction}`);
}
console.log("\n## 確認事項");
for (const w of result.warnings) console.log(`- ${w}`);
console.log(`\n相続分合計チェック: ${result.allSharesSumToOne ? "OK" : "NG（計算ロジックを確認してください）"}`);
