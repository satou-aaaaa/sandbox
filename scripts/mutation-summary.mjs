#!/usr/bin/env node
/**
 * Stryker のJSONレポートから、生き残りミュータントの要約（Markdown）を標準出力へ出す。
 *
 * 使い方: node scripts/mutation-summary.mjs [reports/mutation/mutation.json]
 *         node scripts/mutation-summary.mjs --shards <フォルダ> --expect <組の名前,…>
 *           週次CIの組（シャード）ごとのレポート <フォルダ>/<組の名前>/mutation.json をまとめる。
 *           届かなかった組は要約に書き、終了コード1にする（時間切れ・異常終了を見落とさないため）。
 * 事前に `npx stryker run --reporters json,clear-text` などでJSONレポートを作っておく。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { mergeReports, summarizeMutation } from "./lib/mutationSummary.mjs";

/** @param {string} p */
function read(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

const args = process.argv.slice(2);
const shardsAt = args.indexOf("--shards");
if (shardsAt === -1) {
  const p = args[0] ?? "reports/mutation/mutation.json";
  let report;
  try {
    report = read(p);
  } catch (e) {
    console.error(`レポートを読めません: ${p}（${e instanceof Error ? e.message : String(e)}）`);
    process.exit(1);
  }
  console.log(summarizeMutation(report).markdown);
} else {
  const dir = args[shardsAt + 1];
  const expectAt = args.indexOf("--expect");
  const names = (expectAt === -1 ? "" : args[expectAt + 1] ?? "").split(",").filter(Boolean);
  if (!dir || names.length === 0) {
    console.error("使い方: --shards <フォルダ> --expect <組の名前,…>");
    process.exit(2);
  }
  const reports = [];
  const missing = [];
  for (const n of names) {
    try {
      reports.push(read(path.join(dir, n, "mutation.json")));
    } catch {
      missing.push(n);
    }
  }
  const md = summarizeMutation(mergeReports(reports)).markdown;
  const note = missing.length === 0 ? `全 ${names.length} 組の結果をまとめました。` : `⚠️ 結果が届かなかった組（時間切れ・異常終了）: ${missing.join(", ")}。スコアは届いた ${reports.length}/${names.length} 組だけのものです。`;
  console.log(`${md}\n${note}\n`);
  if (missing.length > 0) process.exit(1);
}
