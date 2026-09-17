import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDaijinKyogiRequirement } from "../src/licenses/nouchi-tenyo/eligibility/daijinKyogi.js";

test("4ヘクタール（40,000平方メートル）ちょうどなら大臣協議は不要（境界値）", () => {
  const result = checkDaijinKyogiRequirement(40_000);
  assert.equal(result.passed, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reasons, ["転用面積は4ヘクタール以下のため、農林水産大臣への協議は不要です"]);
  assert.equal(result.label, "農林水産大臣への協議の要否（4ヘクタール超案件）");
});

test("4ヘクタールを1平方メートルでも超えると大臣協議が必要になる（境界値。農地法附則2項1号・3号）", () => {
  const result = checkDaijinKyogiRequirement(40_001);
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["転用面積が4ヘクタールを超えるため、農林水産大臣への協議が必要です"]);
  assert.deepEqual(result.warnings, [
    "転用面積が4ヘクタールを超えています（農地法附則2項1号・3号）。" +
      "都道府県知事等が許可をする前に、あらかじめ農林水産大臣への協議が" +
      "必要となるため、標準処理期間より審査が長期化する見込みです。",
  ]);
});

test("面積が未入力（undefined）の場合は大臣協議不要として扱う", () => {
  const result = checkDaijinKyogiRequirement(undefined);
  assert.equal(result.passed, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reasons, ["転用面積は4ヘクタール以下のため、農林水産大臣への協議は不要です"]);
});

test("いずれの場合もpassed=trueであり、eligibleの合否には影響しない", () => {
  assert.equal(checkDaijinKyogiRequirement(1_000_000).passed, true);
  assert.equal(checkDaijinKyogiRequirement(0).passed, true);
});
