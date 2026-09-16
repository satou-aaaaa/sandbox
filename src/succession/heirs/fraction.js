/**
 * 相続分を扱うための既約分数ユーティリティ（内部専用）。
 *
 * 相続分を浮動小数点で扱うと丸め誤差が生じる（例: 1/3 + 1/3 + 1/3 が
 * 1にならない）ため、内部計算はすべて`BigInt`による既約分数で行う（NFR-S5）。
 */

/**
 * @typedef {Object} Fraction
 * @property {bigint} n 分子
 * @property {bigint} d 分母（常に正）
 */

/** @param {bigint} a @param {bigint} b @returns {bigint} */
function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

/**
 * 既約分数を作成する。
 * @param {number | bigint} n
 * @param {number | bigint} [d]
 * @returns {Fraction}
 */
export function frac(n, d = 1) {
  const bn = BigInt(n);
  const bd = BigInt(d);
  if (bd === 0n) throw new Error("分母が0の分数は作成できません");
  const sign = bd < 0n ? -1n : 1n;
  const g = gcd(bn, bd);
  return { n: (sign * bn) / g, d: (sign * bd) / g };
}

/** @param {Fraction} a @param {Fraction} b @returns {Fraction} */
export function mulFrac(a, b) {
  return frac(a.n * b.n, a.d * b.d);
}

/** @param {Fraction} a @param {Fraction} b @returns {Fraction} */
export function addFrac(a, b) {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

/** @param {Fraction[]} fracs @returns {Fraction} */
export function sumFrac(fracs) {
  return fracs.reduce(addFrac, frac(0, 1));
}

/**
 * 分数を表示用文字列に整形する。
 * @param {Fraction} f
 * @returns {string} 例: "1/4"（分母1の場合は整数表記）
 */
export function formatFrac(f) {
  return f.d === 1n ? `${f.n}` : `${f.n}/${f.d}`;
}
