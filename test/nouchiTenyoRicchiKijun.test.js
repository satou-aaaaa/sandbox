import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRicchiKijun } from "../src/licenses/nouchi-tenyo/eligibility/ricchiKijun.js";

test("checkRicchiKijun: 第3種農地は原則許可（合格）", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第3種農地" });
  assert.equal(result.passed, true);
});

test("checkRicchiKijun: 第2種農地は代替地が無ければ合格", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第2種農地", hasNoAlternativeLand: true });
  assert.equal(result.passed, true);
});

test("checkRicchiKijun: 第2種農地は代替地があれば不合格", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第2種農地", hasNoAlternativeLand: false });
  assert.equal(result.passed, false);
});

test("checkRicchiKijun: 農用地区域内農地は例外事由が無ければ不合格", () => {
  const result = checkRicchiKijun({ nouchiKubun: "農用地区域内農地" });
  assert.equal(result.passed, false);
});

test("checkRicchiKijun: 甲種農地は例外事由があれば合格するが、一次判定である旨の警告が必ず付く", () => {
  const result = checkRicchiKijun({ nouchiKubun: "甲種農地", hasExceptionReason: true, exceptionReasonNote: "土地改良事業の施行区域除外予定" });
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("農業委員会"));
});

test("checkRicchiKijun: 第1種農地も原則不許可のグループとして扱われる", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第1種農地" });
  assert.equal(result.passed, false);
});

test("checkRicchiKijun: 第3種農地・第2種農地でも警告なしにはならない（第2種は警告あり、第3種は警告なしの想定）", () => {
  assert.equal(checkRicchiKijun({ nouchiKubun: "第3種農地" }).warnings.length, 0);
  assert.equal(checkRicchiKijun({ nouchiKubun: "第2種農地", hasNoAlternativeLand: true }).warnings.length, 1);
});
