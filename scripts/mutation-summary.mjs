#!/usr/bin/env node
/**
 * Stryker のJSONレポートから、生き残りミュータントの要約（Markdown）を標準出力へ出す。
 *
 * 使い方: node scripts/mutation-summary.mjs [reports/mutation/mutation.json]
 * 事前に `npx stryker run --reporters json,clear-text` などでJSONレポートを作っておく。
 */
import { readFileSync } from "node:fs";
import { summarizeMutation } from "./lib/mutationSummary.mjs";

const path = process.argv[2] ?? "reports/mutation/mutation.json";
let report;
try {
  report = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`レポートを読めません: ${path}（${e instanceof Error ? e.message : String(e)}）`);
  process.exit(1);
}
console.log(summarizeMutation(report).markdown);
