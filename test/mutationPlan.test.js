// 週次ミューテーションテストの組（シャード）の分け方の検査（scripts/lib/mutationPlan.mjs）。
// 2026-10 に全部を1ジョブで流して2時間の上限で4週続けて止まっていたため、組に分けるようにした。
import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../stryker.config.mjs";
import { planFromConfig, planShards, reachableFiles, shardNameOf } from "../scripts/lib/mutationPlan.mjs";

const fake = (/** @type {Record<string, string>} */ files) => (/** @type {string} */ p) => files[p] ?? null;

test("shardNameOf: モジュールごとの名前", () => {
  assert.equal(shardNameOf("src/licenses/kobutsu/eligibility/engine.js"), "kobutsu");
  assert.equal(shardNameOf("src/core/reminders/digest.js"), "core-reminders");
  assert.equal(shardNameOf("src/portal/reminders/caseDeadlines.js"), "portal");
  assert.equal(shardNameOf("scripts/x.js"), "other");
});

test("reachableFiles: 静的・動的 import と、子プロセスで動かすスクリプトの文字列をたどる", () => {
  const read = fake({
    "test/a.test.js": `import { x } from "../src/a.js";\nconst cli = "scripts/run.mjs";\nawait import("../src/dyn.js");`,
    "src/a.js": `export { y } from "./b.js";`,
    "src/b.js": `import "./c.js";`,
    "src/c.js": ``,
    "scripts/run.mjs": `import { d } from "../src/d.js";`,
    "src/d.js": ``,
    "src/dyn.js": ``,
  });
  const r = reachableFiles("test/a.test.js", read);
  for (const f of ["src/a.js", "src/b.js", "src/c.js", "scripts/run.mjs", "src/d.js", "src/dyn.js"]) assert.ok(r.has(f), f);
});

test("planShards: 大きいモジュールは分け、組ごとに届くテストだけを選ぶ", () => {
  const read = fake({
    "test/k.test.js": `import "../src/licenses/k/a.js";`,
    "test/all.test.js": `import "../src/licenses/k/c.js"; import "../src/core/x/y.js";`,
    "test/none.test.js": `import "node:fs";`,
  });
  const shards = planShards(["src/licenses/k/a.js", "src/licenses/k/b.js", "src/licenses/k/c.js", "src/core/x/y.js"], ["test/all.test.js", "test/k.test.js", "test/none.test.js"], read, 2);
  assert.deepEqual(shards.map((s) => s.name), ["core-x", "k-1", "k-2"]);
  assert.deepEqual(shards.find((s) => s.name === "core-x")?.tests, ["test/all.test.js"]);
  assert.deepEqual(shards.find((s) => s.name === "k-1")?.mutate, ["src/licenses/k/a.js", "src/licenses/k/c.js"]);
  assert.deepEqual(shards.find((s) => s.name === "k-1")?.tests, ["test/all.test.js", "test/k.test.js"]);
  assert.deepEqual(shards.find((s) => s.name === "k-2")?.tests, []);
});

test("本物の設定: 変えるファイルはどれか1つの組にだけ入り、どの組にもテストが届く", () => {
  const shards = planFromConfig(config);
  const all = shards.flatMap((s) => s.mutate);
  assert.ok(all.length > 0, "変えるファイルが見つからない");
  assert.equal(new Set(all).size, all.length, "同じファイルが2つの組に入っている");
  assert.deepEqual(shards.filter((s) => s.tests.length === 0).map((s) => s.name), [], "テストが届かない組がある（生き残りが全部「未到達」になる）");
  // GitHub Actions の matrix は1つのワークフローで256組まで。無料の同時実行（20）も目安にする
  assert.ok(shards.length <= 20, `組が多すぎる: ${shards.length}`);
  // 組の名前は artifact の名前とフォルダ名に使う
  for (const s of shards) assert.match(s.name, /^[a-z0-9-]+$/);
});
