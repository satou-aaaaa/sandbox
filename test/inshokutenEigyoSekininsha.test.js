import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSekininsha } from "../src/licenses/inshokuten-eigyo/eligibility/sekininsha.js";
import { buildSampleInshokutenEigyoProfile } from "../scripts/sampleInshokutenEigyoProfile.js";

test("checkSekininsha: サンプルデータ（調理師資格）はpassed=trueになる", () => {
  const result = checkSekininsha(buildSampleInshokutenEigyoProfile().sekininsha);
  assert.equal(result.passed, true);
});

for (const qualificationType of ["調理師", "製菓衛生師", "栄養士", "講習会受講修了"]) {
  test(`checkSekininsha: 資格種別「${qualificationType}」はpassed=trueになる`, () => {
    const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
    sekininsha.qualificationType = /** @type {any} */ (qualificationType);
    const result = checkSekininsha(sekininsha);
    assert.equal(result.passed, true);
  });
}

test("checkSekininsha: 資格種別が「未定」ならpassed=falseになる", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.qualificationType = "未定";
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, false);
});

test("checkSekininsha: 氏名が未入力ならpassed=falseになる", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.name = "";
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, false);
});

test("checkSekininsha: 店舗専属設置でなければpassed=falseになる", () => {
  const sekininsha = buildSampleInshokutenEigyoProfile().sekininsha;
  sekininsha.isDesignatedPerStore = false;
  const result = checkSekininsha(sekininsha);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("専属")));
});
