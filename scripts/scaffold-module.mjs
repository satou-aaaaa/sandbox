#!/usr/bin/env node
/**
 * 新しい許可種別アドオンの雛形（src/・test/・docs/）を作る。判定ロジックは作らない。
 *
 * 使い方: npm run scaffold:module -- <ケバブケース名> "<日本語の名称>" [--dry-run]
 *   例:   npm run scaffold:module -- shokuhin-hanbai "食品販売業許可"
 *
 * 既存のファイルは上書きしない（1つでも存在すれば何も作らず中止する）。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO_ROOT } from "./lib/legalBasis.mjs";
import { buildScaffold, followUpChecklist } from "./lib/scaffold.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const [name, label] = args;
if (!name || !label) {
  console.error('使い方: npm run scaffold:module -- <ケバブケース名> "<日本語の名称>" [--dry-run]');
  process.exit(2);
}

let files;
try {
  files = buildScaffold(name, label);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}

const existing = Object.keys(files).filter((rel) => existsSync(join(REPO_ROOT, rel)));
if (existing.length > 0) {
  console.error(`既に存在するファイルがあるため中止しました（上書きしません）:\n${existing.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}

for (const [rel, content] of Object.entries(files)) {
  console.log(`${dryRun ? "[dry-run] " : ""}作成: ${rel}`);
  if (dryRun) continue;
  mkdirSync(dirname(join(REPO_ROOT, rel)), { recursive: true });
  writeFileSync(join(REPO_ROOT, rel), content);
}
console.log("\n次にやること:");
for (const item of followUpChecklist(name, label)) console.log(`- [ ] ${item}`);
