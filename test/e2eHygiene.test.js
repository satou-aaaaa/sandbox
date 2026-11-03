/**
 * E2E（e2e/*.spec.js）の書き方の機械検査。
 *
 * 下書き（drafts.json）はE2Eの全テストで1つのファイルを共有し、テストのあとも消さない。
 * 下書きを保存するテストが固定の名前を使うと、CI のやり直し（playwright.config.js の retries）や
 * 並行実行（fullyParallel）で前の回の下書きが一覧に残り、同じ名前の行が2つになって落ちる
 * （2026-11-04 main の Test が「strict mode violation: … resolved to 2 elements」で落ちた）。
 * そのため、下書きを保存するテストは実行ごとに一意な名前（Date.now() など）を使う。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../scripts/lib/legalBasis.mjs";

const e2eDir = join(REPO_ROOT, "e2e");
const specs = readdirSync(e2eDir).filter((f) => f.endsWith(".spec.js"));

/** spec の本文を test( ごとに切り分ける（先頭の import などは捨てる） */
function testBlocks(text) {
  return text.split(/^test\(/m).slice(1).map((b) => ({ title: (b.match(/^\s*["'`]([^"'`]*)/) || [])[1] || "(題なし)", body: b }));
}

test("E2E: 下書きを保存するテストは、実行ごとに一意な名前を使う", () => {
  const bad = [];
  for (const f of specs) {
    for (const { title, body } of testBlocks(readFileSync(join(e2eDir, f), "utf8"))) {
      if (!body.includes("下書きとして保存")) continue;
      if (!/Date\.now\(\)|randomUUID\(\)/.test(body)) bad.push(`${f}: ${title}`);
    }
  }
  assert.deepEqual(bad, [], "下書きの名前に Date.now() などを付けて、やり直し・並行実行で前の回の下書きと混ざらないようにする");
});

test("E2E: 下書きを保存するテストが1つ以上ある（上の検査が空回りしていない）", () => {
  const n = specs.flatMap((f) => testBlocks(readFileSync(join(e2eDir, f), "utf8"))).filter((b) => b.body.includes("下書きとして保存")).length;
  assert.ok(n >= 3, `下書きを保存するテストが ${n} 件しか見つからない（切り分け方が壊れていないか）`);
});
