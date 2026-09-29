#!/usr/bin/env node
/**
 * PRのリスクを分類して標準出力にJSONで返す（GitHub Actionsの agent-pr-automerge から呼ぶ）。
 *
 * 使い方: node agent/pr-risk.mjs <PR番号>
 * 出力:   {"level":"low"|"high","reasons":["..."]}
 *
 * 分類ロジック（policy.js の classifyPrRisk）は、PRのコードではなく main のコードを
 * チェックアウトして実行する（ワークフロー側で保証）。GH_TOKEN が必要。
 */
import { execFileSync } from "node:child_process";
import { classifyPrRisk } from "./policy.js";

const pr = process.argv[2];
if (!/^\d+$/.test(pr ?? "")) {
  console.error("PR番号（数字）を指定してください");
  process.exit(2);
}
const json = execFileSync("gh", ["pr", "view", pr, "--json", "files"], { encoding: "utf8" });
const files = JSON.parse(json).files.map((/** @type {any} */ f) => ({ path: f.path, additions: f.additions, deletions: f.deletions }));
console.log(JSON.stringify(classifyPrRisk(files)));
