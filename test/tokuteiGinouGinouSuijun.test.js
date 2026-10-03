import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGinouSuijun } from "../src/licenses/tokutei-ginou/eligibility/ginouSuijun.js";
import { clearFields, registerField } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";

function setUpField() {
  clearFields();
  registerField({
    fieldKey: "gaishokugyou",
    fieldLabel: "外食業",
    skillTestName: "外食業技能測定試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "テスト用の留意事項",
  });
}

test("checkGinouSuijun: 技能評価試験に合格している場合はpassed=trueになる", () => {
  setUpField();
  const result = checkGinouSuijun({ fieldKey: "gaishokugyou", hasPassedSkillTest: true, hasCompletedGinouJisshu2GoWell: false });
  assert.equal(result.passed, true);
  assert.ok(result.reasons.some((r) => r.includes("外食業技能測定試験")));
});

test("checkGinouSuijun: 技能実習2号を良好に修了している場合（作業区分の関連性あり）はpassed=trueで警告なし", () => {
  setUpField();
  const result = checkGinouSuijun({
    fieldKey: "gaishokugyou",
    hasPassedSkillTest: false,
    hasCompletedGinouJisshu2GoWell: true,
    isSameWorkCategoryAsGinouJisshu: true,
  });
  assert.equal(result.passed, true);
  assert.ok(!result.warnings.some((w) => w.includes("作業区分")));
});

test("checkGinouSuijun: 技能実習2号良好修了だが作業区分の関連性なしの場合は警告が出る", () => {
  setUpField();
  const result = checkGinouSuijun({
    fieldKey: "gaishokugyou",
    hasPassedSkillTest: false,
    hasCompletedGinouJisshu2GoWell: true,
    isSameWorkCategoryAsGinouJisshu: false,
  });
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("業務区分が同一でない可能性")));
});

test("checkGinouSuijun: 技能実習2号良好修了だが作業区分の関連性が未入力の場合は確認を促す警告が出る", () => {
  setUpField();
  const result = checkGinouSuijun({ fieldKey: "gaishokugyou", hasPassedSkillTest: false, hasCompletedGinouJisshu2GoWell: true });
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("必ず確認してください")));
});

test("checkGinouSuijun: どちらも満たさない場合はpassed=falseになる", () => {
  setUpField();
  const result = checkGinouSuijun({ fieldKey: "gaishokugyou", hasPassedSkillTest: false, hasCompletedGinouJisshu2GoWell: false });
  assert.equal(result.passed, false);
});

test("checkGinouSuijun: 分野の留意事項が警告に含まれる", () => {
  setUpField();
  const result = checkGinouSuijun({ fieldKey: "gaishokugyou", hasPassedSkillTest: true, hasCompletedGinouJisshu2GoWell: false });
  assert.ok(result.warnings.some((w) => w.includes("テスト用の留意事項")));
});

test("checkGinouSuijun: 未登録の分野キーでもエラーにならずフィールドキーがそのまま表示される", () => {
  clearFields();
  const result = checkGinouSuijun({ fieldKey: "unknown-field", hasPassedSkillTest: true, hasCompletedGinouJisshu2GoWell: false });
  assert.ok(result.reasons.some((r) => r.includes("unknown-field")));
});

test("checkGinouSuijun: 未登録の分野キーで技能評価試験に合格した場合、試験名のフォールバック文言「分野別試験」が使われる", () => {
  clearFields();
  const result = checkGinouSuijun({ fieldKey: "unknown-field", hasPassedSkillTest: true, hasCompletedGinouJisshu2GoWell: false });
  assert.ok(result.reasons[0].includes("分野別試験"));
});

test("checkGinouSuijun: 技能実習2号修了時のkey・label・reasons・warningsを厳密に確認（留意事項なしの分野）", () => {
  clearFields();
  registerField({ fieldKey: "no-note-field", fieldLabel: "留意事項なし分野" });
  const result = checkGinouSuijun({
    fieldKey: "no-note-field",
    hasPassedSkillTest: false,
    hasCompletedGinouJisshu2GoWell: true,
    isSameWorkCategoryAsGinouJisshu: true,
  });
  assert.equal(result.key, "ginouSuijun");
  assert.equal(result.label, "技能水準要件");
  assert.deepEqual(result.reasons, ["技能実習2号を良好に修了しているため、技能水準要件は満たされているものとみなされます"]);
  assert.deepEqual(result.warnings, []);
});

test("checkGinouSuijun: どちらも満たさない場合のreasons・warningsを厳密に確認（留意事項なしの分野）", () => {
  clearFields();
  registerField({ fieldKey: "no-note-field", fieldLabel: "留意事項なし分野" });
  const result = checkGinouSuijun({ fieldKey: "no-note-field", hasPassedSkillTest: false, hasCompletedGinouJisshu2GoWell: false });
  assert.deepEqual(result.reasons, ["分野「留意事項なし分野」の技能評価試験に合格しておらず、技能実習2号の良好な修了もありません"]);
  assert.deepEqual(result.warnings, []);
});
