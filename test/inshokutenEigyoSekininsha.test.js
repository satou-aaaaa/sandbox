import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSekininsha } from "../src/licenses/inshokuten-eigyo/eligibility/sekininsha.js";
import { buildSampleInshokutenEigyoProfile } from "../scripts/sampleInshokutenEigyoProfile.js";

test("checkSekininsha: サンプルデータ（調理師資格）はpassed=trueになる", () => {
  const result = checkSekininsha(buildSampleInshokutenEigyoProfile().sekininsha);
  assert.equal(result.key, "sekininsha");
  assert.equal(result.label, "食品衛生責任者の設置");
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["サンプル花子氏（調理師資格による講習免除）を食品衛生責任者として設置予定です"]);
  assert.deepEqual(result.warnings, []);
});

for (const qualificationType of ["調理師", "製菓衛生師", "栄養士"]) {
  test(`checkSekininsha: 資格種別「${qualificationType}」はpassed=trueになり、資格名が理由に含まれる`, () => {
    const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
    sekininsha.qualificationType = /** @type {any} */ (qualificationType);
    const result = checkSekininsha(sekininsha);
    assert.equal(result.passed, true);
    assert.equal(result.reasons[0], `${sekininsha.name}氏（${qualificationType}資格による講習免除）を食品衛生責任者として設置予定です`);
  });
}

test("checkSekininsha: 資格種別「講習会受講修了」はpassed=trueになり、資格名ではなく講習修了である旨が理由になる", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.qualificationType = "講習会受講修了";
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, true);
  assert.equal(result.reasons[0], `${sekininsha.name}氏（講習会受講修了）を食品衛生責任者として設置予定です`);
});

test("checkSekininsha: 資格種別が「未定」ならpassed=falseになる", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.qualificationType = "未定";
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["食品衛生責任者が未設置、または資格の種別が未定です"]);
});

test("checkSekininsha: 氏名が未入力ならpassed=falseになる", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.name = "";
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["食品衛生責任者が未設置、または資格の種別が未定です"]);
});

test("checkSekininsha: 店舗専属設置でなければpassed=falseになる（資格要件自体は満たしたうえでの不合格）", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.isDesignatedPerStore = false;
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, [
    "サンプル花子氏（調理師資格による講習免除）を食品衛生責任者として設置予定です",
    "食品衛生責任者は店舗ごとの専属設置が必要です",
  ]);
});
