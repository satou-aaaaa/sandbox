import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKanrensei } from "../src/licenses/gijinkoku/eligibility/kanrensei.js";

test("checkKanrensei: 常にpassed=trueを返す（機械判定しない設計）", () => {
  const result = checkKanrensei({ majorOrExperienceField: "情報工学", jobDescription: "システム開発" });
  assert.equal(result.passed, true);
});

test("checkKanrensei: 必ず人手確認を促す警告を含む", () => {
  const result = checkKanrensei({ majorOrExperienceField: "情報工学", jobDescription: "システム開発" });
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("個別に確認"));
});

test("checkKanrensei: 専攻分野・職務内容が理由に含まれる", () => {
  const result = checkKanrensei({ majorOrExperienceField: "情報工学", jobDescription: "システム開発" });
  assert.ok(result.reasons.some((r) => r.includes("情報工学")));
  assert.ok(result.reasons.some((r) => r.includes("システム開発")));
});
