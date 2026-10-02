import { test } from "node:test";
import assert from "node:assert/strict";
import { checkResidentType } from "../src/licenses/minpaku/eligibility/residentType.js";

test("checkResidentType: 家主居住型なら常に合格し、key/label/reasons/警告なしが厳密に一致する", () => {
  const result = checkResidentType("家主居住型", undefined);
  assert.equal(result.key, "residentType");
  assert.equal(result.label, "家主居住型／家主不在型の確認");
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["家主居住型として届出予定です"]);
  assert.equal(result.warnings.length, 0);
});

test("checkResidentType: 家主不在型で委託先未確定なら合格するが警告を出す", () => {
  const result = checkResidentType("家主不在型", undefined);
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("管理委託が必須"));
});

test("checkResidentType: 家主不在型で委託先確定済みなら警告なし", () => {
  const result = checkResidentType("家主不在型", "サンプル住宅宿泊管理株式会社");
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 0);
});
