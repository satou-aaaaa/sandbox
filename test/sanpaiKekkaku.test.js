import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSanpaiKekkaku } from "../src/licenses/sanpai/eligibility/kekkaku.js";

/** @returns {import('../src/licenses/sanpai/eligibility/types.js').SanpaiKekkakuInput} */
function cleanInput() {
  return {
    hasMentalImpairmentAffectingDuties: false,
    isUndischargedBankrupt: false,
    hasCriminalRecordWithin5Years: false,
    hasWasteLawViolationWithin5Years: false,
    hadPermitRevokedWithin5Years: false,
    hasBusinessClosureDuringRevocationProcessWithin5Years: false,
    hasDishonestConductRisk: false,
    isBoryokudanRelated: false,
  };
}

test("checkSanpaiKekkaku: 全項目該当なしなら合格する", () => {
  const result = checkSanpaiKekkaku(cleanInput());
  assert.equal(result.passed, true);
  assert.ok(result.reasons.some((r) => r.includes("該当する項目はありません")));
});

test("checkSanpaiKekkaku: 心身の故障（7条5項4号イ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasMentalImpairmentAffectingDuties: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("心身の故障")));
});

test("checkSanpaiKekkaku: 破産手続開始（7条5項4号ロ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), isUndischargedBankrupt: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("破産")));
});

test("checkSanpaiKekkaku: 拘禁刑以上の刑（7条5項4号ハ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasCriminalRecordWithin5Years: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("拘禁刑")));
});

test("checkSanpaiKekkaku: 廃棄物処理法・浄化槽法違反等の罰金刑（7条5項4号ニ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasWasteLawViolationWithin5Years: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("罰金刑")));
});

test("checkSanpaiKekkaku: 許可取消し（7条5項4号ホ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hadPermitRevokedWithin5Years: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("許可の取消し")));
});

test("checkSanpaiKekkaku: 取消し逃れの事業廃止届出（7条5項4号ヘ・ト）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasBusinessClosureDuringRevocationProcessWithin5Years: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("事業廃止")));
});

test("checkSanpaiKekkaku: 不正・不誠実行為のおそれ（7条5項4号チ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasDishonestConductRisk: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("不正又は不誠実")));
});

test("checkSanpaiKekkaku: 暴力団関係（14条5項2号ロ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), isBoryokudanRelated: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("暴力団員")));
});

test("checkSanpaiKekkaku: 複数の欠格事由に同時に該当する場合はすべて理由に含まれる", () => {
  const input = { ...cleanInput(), isUndischargedBankrupt: true, isBoryokudanRelated: true };
  const result = checkSanpaiKekkaku(input);
  assert.equal(result.passed, false);
  assert.equal(result.reasons.length, 2);
});
