import { test } from "node:test";
import assert from "node:assert/strict";
import { frac, mulFrac, addFrac, sumFrac, formatFrac } from "../src/succession/heirs/fraction.js";

test("frac: 約分される（2/4 → 1/2）", () => {
  const f = frac(2, 4);
  assert.equal(f.n, 1n);
  assert.equal(f.d, 2n);
});

test("frac: 分母が負の場合は符号を分子側へ正規化する", () => {
  const f = frac(1, -2);
  assert.equal(f.n, -1n);
  assert.equal(f.d, 2n);
});

test("frac: 分子が負で約分を要する場合も分母は常に正になる（gcd内部の符号正規化）", () => {
  // gcd()内部でnの符号を正規化する処理（a = a < 0n ? -a : a）が壊れると、
  // gcd自体が負の値を返し、結果の分母が負になってしまう不具合を検出する。
  const f = frac(-6, 4);
  assert.equal(f.n, -3n);
  assert.equal(f.d, 2n);
  assert.equal(formatFrac(f), "-3/2");
});

test("frac: 分母が負で約分を要する場合も分母は常に正になる（gcd内部の符号正規化）", () => {
  // 上記と対になるテスト。gcd()内部でdの符号を正規化する処理
  // （b = b < 0n ? -b : b）が壊れると、分子・分母を約分する除数
  // （gcdの戻り値）自体が負になり、結果の符号が反転してしまう不具合を検出する。
  const f = frac(4, -6);
  assert.equal(f.n, -2n);
  assert.equal(f.d, 3n);
  assert.equal(formatFrac(f), "-2/3");
});

test("frac: 分母0はエラーになる", () => {
  assert.throws(() => frac(1, 0), /分母が0/);
});

test("mulFrac: 分数同士の乗算が正しく約分される", () => {
  const result = mulFrac(frac(1, 2), frac(2, 3));
  assert.equal(formatFrac(result), "1/3");
});

test("addFrac: 分数同士の加算が正しく約分される", () => {
  const result = addFrac(frac(1, 4), frac(1, 4));
  assert.equal(formatFrac(result), "1/2");
});

test("sumFrac: 1/3を3つ加算すると誤差なく1になる（浮動小数点では起きない丸め誤差の回避を確認）", () => {
  const result = sumFrac([frac(1, 3), frac(1, 3), frac(1, 3)]);
  assert.equal(formatFrac(result), "1");
  assert.equal(result.n, 1n);
  assert.equal(result.d, 1n);
});

test("sumFrac: 空配列は0を返す", () => {
  const result = sumFrac([]);
  assert.equal(formatFrac(result), "0");
});

test("formatFrac: 分母1の場合は整数表記になる", () => {
  assert.equal(formatFrac(frac(4, 2)), "2");
});

test("formatFrac: 通常の分数はn/d形式になる", () => {
  assert.equal(formatFrac(frac(1, 4)), "1/4");
});
