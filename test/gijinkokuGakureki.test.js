import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGakureki } from "../src/licenses/gijinkoku/eligibility/gakureki.js";

// 項目一（自然科学・人文科学分野の技術・知識を要する業務）
test("checkGakureki: 項目一・大学卒業以上なら実務経験に関わらず合格する", () => {
  const result = checkGakureki({ educationLevel: "大学卒業以上", isInternationalServiceCategory: false });
  assert.equal(result.passed, true);
});

test("checkGakureki: 項目一・専修学校専門課程修了でも合格する", () => {
  const result = checkGakureki({ educationLevel: "専修学校専門課程修了", isInternationalServiceCategory: false });
  assert.equal(result.passed, true);
});

test("checkGakureki: 項目一・学歴要件なしで実務経験10年以上なら合格する", () => {
  const result = checkGakureki({ educationLevel: "それ以外", isInternationalServiceCategory: false, yearsOfRelevantExperience: 10 });
  assert.equal(result.passed, true);
});

test("checkGakureki: 項目一・学歴要件なしで実務経験10年未満なら不合格（境界値）", () => {
  const result = checkGakureki({ educationLevel: "それ以外", isInternationalServiceCategory: false, yearsOfRelevantExperience: 9 });
  assert.equal(result.passed, false);
});

test("checkGakureki: 項目一・学歴も実務経験も無ければ不合格", () => {
  const result = checkGakureki({ educationLevel: "それ以外", isInternationalServiceCategory: false });
  assert.equal(result.passed, false);
});

// 項目二（国際業務区分）
test("checkGakureki: 項目二・大学卒業者が通訳業務に従事する場合は実務経験なしでも合格する", () => {
  const result = checkGakureki({
    educationLevel: "大学卒業以上",
    isInternationalServiceCategory: true,
    isTranslationInterpretationOrLanguageInstruction: true,
  });
  assert.equal(result.passed, true);
  assert.ok(result.reasons[0].includes("免除"));
});

test("checkGakureki: 項目二・大学卒業でも通訳等以外の業務（広報等）なら実務経験3年が必要", () => {
  const result = checkGakureki({
    educationLevel: "大学卒業以上",
    isInternationalServiceCategory: true,
    isTranslationInterpretationOrLanguageInstruction: false,
    yearsOfRelevantExperience: 2,
  });
  assert.equal(result.passed, false);
  assert.ok(result.reasons[0].includes("大学卒業による一律免除は無く"));
});

test("checkGakureki: 項目二・実務経験3年以上なら合格する（境界値）", () => {
  const result = checkGakureki({
    educationLevel: "それ以外",
    isInternationalServiceCategory: true,
    yearsOfRelevantExperience: 3,
  });
  assert.equal(result.passed, true);
});

test("checkGakureki: 項目二・実務経験3年未満なら不合格（境界値）", () => {
  const result = checkGakureki({
    educationLevel: "それ以外",
    isInternationalServiceCategory: true,
    yearsOfRelevantExperience: 2,
  });
  assert.equal(result.passed, false);
});

test("checkGakureki: 項目二・通訳等業務でも大学卒業でなければ実務経験3年が必要", () => {
  const result = checkGakureki({
    educationLevel: "それ以外",
    isInternationalServiceCategory: true,
    isTranslationInterpretationOrLanguageInstruction: true,
    yearsOfRelevantExperience: 1,
  });
  assert.equal(result.passed, false);
});
