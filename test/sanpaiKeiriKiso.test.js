import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKeiriKiso } from "../src/licenses/sanpai/eligibility/keiriKiso.js";

test("checkKeiriKiso: 自己資本額が正なら合格し警告なし", () => {
  const result = checkKeiriKiso({ latestNetAssets: 1_000_000 });
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 0);
});

test("checkKeiriKiso: 自己資本額がちょうど0なら合格（境界値。負のみ債務超過扱い）", () => {
  const result = checkKeiriKiso({ latestNetAssets: 0 });
  assert.equal(result.passed, true);
});

test("checkKeiriKiso: 自己資本額が負（債務超過）なら不合格だが説明の余地がある旨の警告を付ける", () => {
  const result = checkKeiriKiso({ latestNetAssets: -500_000 });
  assert.equal(result.passed, false);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("改善計画"));
});
