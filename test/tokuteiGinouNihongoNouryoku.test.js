import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNihongoNouryoku } from "../src/licenses/tokutei-ginou/eligibility/nihongoNouryoku.js";
import { clearFields, registerField } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";

function setUpFields() {
  clearFields();
  registerField({ fieldKey: "kaigo", fieldLabel: "介護", skillTestName: "介護技能評価試験", requiresSectorSpecificJapaneseTest: true });
  registerField({ fieldKey: "gaishokugyou", fieldLabel: "外食業", skillTestName: "外食業技能測定試験", requiresSectorSpecificJapaneseTest: false });
}

test("checkNihongoNouryoku: JLPT N4以上合格でpassed=trueになる", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: true, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.equal(result.passed, true);
});

test("checkNihongoNouryoku: JFT-Basic合格でpassed=trueになる", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: false, hasPassedJftBasic: true, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.equal(result.passed, true);
});

test("checkNihongoNouryoku: 技能実習2号修了による免除でpassed=trueになる", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: false, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: true }, "gaishokugyou");
  assert.equal(result.passed, true);
  assert.ok(result.reasons.some((r) => r.includes("免除")));
});

test("checkNihongoNouryoku: いずれも満たさない場合はpassed=falseになる", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: false, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.equal(result.passed, false);
});

test("checkNihongoNouryoku: 分野固有の日本語試験フラグが立っている分野（介護）で警告が出る", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: true, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "kaigo");
  assert.ok(result.warnings.some((w) => w.includes("介護日本語評価試験")));
});

test("checkNihongoNouryoku: 分野固有の日本語試験フラグが立っていない分野では警告が出ない", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: true, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.equal(result.warnings.length, 0);
});

test("checkNihongoNouryoku: 不合格の場合は分野固有試験の警告は出ない（要件自体を満たしていないため）", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: false, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "kaigo");
  assert.equal(result.passed, false);
  assert.equal(result.warnings.length, 0);
});

test("checkNihongoNouryoku: JLPT N4以上合格時のkey・label・reasons・warningsを厳密に確認", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: true, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.equal(result.key, "nihongoNouryoku");
  assert.equal(result.label, "日本語能力水準要件");
  assert.deepEqual(result.reasons, ["日本語能力試験N4以上に合格しています"]);
  assert.deepEqual(result.warnings, []);
});

test("checkNihongoNouryoku: JFT-Basic合格時のreasonsを厳密に確認", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: false, hasPassedJftBasic: true, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.deepEqual(result.reasons, ["JFT-Basic（国際交流基金日本語基礎テスト）に合格しています"]);
});

test("checkNihongoNouryoku: いずれも満たさない場合のreasonsを厳密に確認", () => {
  setUpFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: false, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "gaishokugyou");
  assert.deepEqual(result.reasons, [
    "日本語能力試験N4以上・JFT-Basicのいずれの合格も確認できず、技能実習2号修了による免除にも該当しません",
  ]);
});

test("checkNihongoNouryoku: 未登録の分野キーでも合格時にエラーにならず警告も出ない（オプショナルチェイニング）", () => {
  clearFields();
  const result = checkNihongoNouryoku({ hasJlptN4OrAbove: true, hasPassedJftBasic: false, isExemptByGinouJisshu2Go: false }, "unknown-field");
  assert.equal(result.passed, true);
  assert.deepEqual(result.warnings, []);
});
