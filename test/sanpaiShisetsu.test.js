import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShisetsu } from "../src/licenses/sanpai/eligibility/shisetsu.js";

test("checkShisetsu: 防止措置ありなら合格する。ただし人手確認の警告は必ず付く", () => {
  const result = checkShisetsu(true);
  assert.equal(result.key, "shisetsu");
  assert.equal(result.label, "運搬施設の要件");
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["自己申告上、運搬容器の飛散・流出・悪臭防止措置は取られています"]);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("現地確認"));
});

test("checkShisetsu: 防止措置なしなら不合格", () => {
  const result = checkShisetsu(false);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["自己申告上、運搬容器の飛散・流出・悪臭防止措置が取られていません"]);
  assert.equal(result.warnings.length, 1);
});
