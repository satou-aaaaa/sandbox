import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShienTaisei } from "../src/licenses/tokutei-ginou/eligibility/shienTaisei.js";

const ALL_COVERED = new Array(10).fill(true);

function baseInput(overrides = {}) {
  return {
    shienMethod: "自社実施",
    hasShienSekininsha: true,
    hasShienTantousha: true,
    hasStaffWithSodanExperience: true,
    canSupportInUnderstandableLanguage: true,
    mandatorySupportItemsCovered: [...ALL_COVERED],
    ...overrides,
  };
}

test("checkShienTaisei: 自社実施で基準を満たす場合はpassed=trueになる", () => {
  const result = checkShienTaisei(baseInput());
  assert.equal(result.passed, true);
});

test("checkShienTaisei: 自社実施で支援責任者が未選任の場合はpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ hasShienSekininsha: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("支援責任者")));
});

test("checkShienTaisei: 自社実施で生活相談経験者が未配置の場合はpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ hasStaffWithSodanExperience: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("生活相談業務")));
});

test("checkShienTaisei: 全部委託で委託先の登録支援機関名が記入済みならpassed=trueになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "全部委託", registeredSupportOrgName: "サンプル登録支援機関" }));
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("登録支援機関として有効に登録")));
});

test("checkShienTaisei: 全部委託で委託先の登録支援機関名が未記入ならpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "全部委託" }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("登録支援機関名が未記入")));
});

test("checkShienTaisei: 一部委託で自社基準を満たす場合はpassed=trueになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託", registeredSupportOrgName: "サンプル登録支援機関" }));
  assert.equal(result.passed, true);
});

test("checkShienTaisei: 一部委託で自社基準を満たさない場合はpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託", hasShienTantousha: false }));
  assert.equal(result.passed, false);
});

test("checkShienTaisei: 一部委託で委託先名が未記入の場合は警告が出る（合否には影響しない）", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託" }));
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("委託先の登録支援機関名が未記入")));
});

test("checkShienTaisei: 義務的支援10項目のうち一部が未カバーの場合、その項目分だけ警告が出る", () => {
  const covered = [...ALL_COVERED];
  covered[0] = false;
  covered[5] = false;
  const result = checkShienTaisei(baseInput({ mandatorySupportItemsCovered: covered }));
  const supportWarnings = result.warnings.filter((w) => w.includes("義務的支援10項目"));
  assert.equal(supportWarnings.length, 2);
  assert.ok(supportWarnings.some((w) => w.includes("事前ガイダンスの提供")));
  assert.ok(supportWarnings.some((w) => w.includes("日本語学習機会の提供")));
});

test("checkShienTaisei: 義務的支援10項目が全てカバーされていれば警告が出ない", () => {
  const result = checkShienTaisei(baseInput());
  assert.equal(result.warnings.filter((w) => w.includes("義務的支援10項目")).length, 0);
});
