import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShisetsu } from "../src/licenses/sanpai/eligibility/shisetsu.js";

test("checkShisetsu: 防止措置ありなら合格する。ただし人手確認の警告は必ず付く", () => {
  const result = checkShisetsu(true);
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
});

test("checkShisetsu: 防止措置なしなら不合格", () => {
  const result = checkShisetsu(false);
  assert.equal(result.passed, false);
  assert.equal(result.warnings.length, 1);
});
