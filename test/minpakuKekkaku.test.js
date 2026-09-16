import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMinpakuKekkaku } from "../src/licenses/minpaku/eligibility/kekkaku.js";

/** @returns {import('../src/licenses/minpaku/eligibility/types.js').MinpakuKekkakuInput} */
function cleanInput() {
  return {
    hasMentalOrPhysicalImpairment: false,
    isUndischargedBankrupt: false,
    hadBusinessSuspensionOrderWithin3Years: false,
    hasCriminalRecordWithin3Years: false,
    isBoryokudanRelated: false,
  };
}

test("checkMinpakuKekkaku: 全項目該当なしなら合格する", () => {
  const result = checkMinpakuKekkaku(cleanInput());
  assert.equal(result.passed, true);
  assert.ok(result.reasons.some((r) => r.includes("該当する項目はありません")));
});

test("checkMinpakuKekkaku: 心身の故障（第1号）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasMentalOrPhysicalImpairment: true };
  const result = checkMinpakuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("心身の故障")));
});

test("checkMinpakuKekkaku: 破産手続開始（第2号）に該当すれば不合格", () => {
  const input = { ...cleanInput(), isUndischargedBankrupt: true };
  const result = checkMinpakuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("破産")));
});

test("checkMinpakuKekkaku: 事業廃止命令（第3号）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hadBusinessSuspensionOrderWithin3Years: true };
  const result = checkMinpakuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("廃止命令")));
});

test("checkMinpakuKekkaku: 拘禁刑・罰金刑（第4号）に該当すれば不合格。理由に「3年」が含まれる", () => {
  const input = { ...cleanInput(), hasCriminalRecordWithin3Years: true };
  const result = checkMinpakuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("3年")));
});

test("checkMinpakuKekkaku: 暴力団関係（第5号）に該当すれば不合格。理由に「5年」が含まれる", () => {
  const input = { ...cleanInput(), isBoryokudanRelated: true };
  const result = checkMinpakuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("5年")));
});

test("checkMinpakuKekkaku: 複数の欠格事由に同時に該当する場合はすべて理由に含まれる", () => {
  const input = { ...cleanInput(), isUndischargedBankrupt: true, isBoryokudanRelated: true };
  const result = checkMinpakuKekkaku(input);
  assert.equal(result.passed, false);
  assert.equal(result.reasons.length, 2);
});
