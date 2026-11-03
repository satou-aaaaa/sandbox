// package.json の overrides の決まり（docs/DEPENDENCY_OVERRIDES.md）の検査。
// 2026-10-28〜31、qs を overrides で `6.16.0` に固定していたため、直った 6.16.1 へ Dependabot が上げられず
// セキュリティ更新が `security_update_not_possible` で落ち続けた。固定と、理由の書き忘れをここで止める。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const doc = readFileSync(new URL("../docs/DEPENDENCY_OVERRIDES.md", import.meta.url), "utf8");

/**
 * 1つの版に固定しているか（`6.16.0`・`=6.16.0`・`v6.16.0`）。範囲（^ ~ > < * x || -）なら false。
 * @param {string} spec
 */
function isExactPin(spec) {
  const s = spec.trim().replace(/^[=v]/, "");
  if (/\s/.test(s)) return false; // `1.2.3 - 2.0.0` などの範囲
  return /^\d+\.\d+\.\d+$/.test(s.split("-")[0]);
}

/**
 * overrides を平らにする（入れ子の `{ "pkg": { "dep": "^1" } }` や `{ ".": "^1" }` も読む）。
 * @param {Record<string, unknown>} o
 * @param {string} [prefix]
 * @returns {Array<[string, string]>}
 */
function flatten(o, prefix = "") {
  /** @type {Array<[string, string]>} */
  const out = [];
  for (const [k, v] of Object.entries(o ?? {})) {
    const name = k === "." ? prefix : k;
    if (typeof v === "string") out.push([name, v]);
    else if (v && typeof v === "object") out.push(...flatten(/** @type {Record<string, unknown>} */ (v), k));
  }
  return out;
}

test("isExactPin: 固定と範囲を見分ける", () => {
  for (const s of ["6.16.0", "=6.16.0", "v1.2.3", "1.0.0-beta.1"]) assert.equal(isExactPin(s), true, s);
  for (const s of ["^6.16.1", "~1.2.2", ">=11.0.1", "11.x", "*", "^1 || ^2", "$qs"]) assert.equal(isExactPin(s), false, s);
});

test("overrides の版は範囲で書く（1つの版に固定すると Dependabot がセキュリティ更新できない）", () => {
  const pinned = flatten(pkg.overrides).filter(([, spec]) => isExactPin(spec));
  assert.deepEqual(pinned, [], `固定している上書きがあります。^ を付けた範囲にする（docs/DEPENDENCY_OVERRIDES.md）: ${JSON.stringify(pinned)}`);
});

test("overrides の全部が docs/DEPENDENCY_OVERRIDES.md の表に、なぜ・外せる条件つきで載っている", () => {
  const rows = new Set([...doc.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]));
  const missing = flatten(pkg.overrides).map(([name]) => name).filter((name) => !rows.has(name));
  assert.deepEqual(missing, [], `表に無い上書き: ${missing.join(", ")}（docs/DEPENDENCY_OVERRIDES.md の「今の上書き」に1行足す）`);
  const stale = [...rows].filter((name) => !flatten(pkg.overrides).some(([n]) => n === name));
  assert.deepEqual(stale, [], `外したのに表に残っている行: ${stale.join(", ")}`);
});
