#!/usr/bin/env node
/**
 * 法令・様式改正ウォッチャー。ソースの冒頭コメントに書いた根拠URL（と docs/law-watch-extra.json の追加ページ）を
 * 取得し、基準線 docs/law-watch-baseline.json と比べて、変化・リンク切れを報告する。
 *
 * 取得するのは公開ページのみ（e-Gov法令API・所管官庁のページ）。個人情報・財務情報・実データは一切送らない
 * （docs/DESIGN.md 1章「外部送信をしない」は、アプリが個人情報を外へ出すことを禁じるもので、これには当たらない。ADR-0018）。
 * このスクリプトはアプリ本体（src/）からは呼ばれず、定期workflow（.github/workflows/law-watch.yml）と手動実行だけで使う。
 *
 * 使い方:
 *   node scripts/law-watch.mjs                 点検して結果（Markdown）を標準出力へ。人の対応が要るとき終了コード 3
 *   node scripts/law-watch.mjs --out report.md 結果をファイルにも書く（GITHUB_OUTPUT があれば attention=true|false も出す）
 *   node scripts/law-watch.mjs --update        内容を確認した後に、基準線を現在の内容へ更新する（取得できなかったURLは据え置き）
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, collectAllHeaderUrls } from "./lib/legalBasis.mjs";
import { buildReportMarkdown, compareWithBaseline, egovLawId, needsAttention, snapshotEgov, snapshotHtml } from "./lib/lawWatch.mjs";

const BASELINE_PATH = join(REPO_ROOT, "docs/law-watch-baseline.json");
const EXTRA_PATH = join(REPO_ROOT, "docs/law-watch-extra.json");
const TIMEOUT_MS = 30_000;
const RETRIES = 2;
const USER_AGENT = "kensetsu-kyoka-toolkit-law-watch (+https://github.com/satou-aaaaa/sandbox)";

const args = process.argv.slice(2);
const update = args.includes("--update");
const outPath = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;

/** @param {string} p @param {any} fallback */
function readJson(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

/** @param {string} url @returns {Promise<import("./lib/lawWatch.mjs").FetchResult>} */
async function fetchOnce(url) {
  const lawId = egovLawId(url);
  const target = lawId ? `https://laws.e-gov.go.jp/api/2/law_data/${lawId}?response_format=json` : url;
  const res = await fetch(target, { headers: { "user-agent": USER_AGENT, accept: lawId ? "application/json" : "text/html,*/*" }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return { ok: true, snapshot: lawId ? snapshotEgov(await res.json()) : snapshotHtml(await res.text()) };
}

/** 一時的な失敗に備えて再試行する。 @param {string} url */
async function fetchWithRetry(url) {
  /** @type {import("./lib/lawWatch.mjs").FetchResult} */
  let last = { ok: false, error: "未実行" };
  for (let i = 0; i <= RETRIES; i++) {
    try {
      last = await fetchOnce(url);
      if (last.ok || !/^HTTP 5\d\d$/.test(last.error)) return last; // 4xx（移転・廃止）は再試行しても変わらない
    } catch (e) {
      last = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return last;
}

const sources = collectAllHeaderUrls();
for (const extra of readJson(EXTRA_PATH, { sources: [] }).sources ?? []) {
  if (typeof extra?.url === "string") sources.set(extra.url, [...(sources.get(extra.url) ?? []), `docs/law-watch-extra.json${extra.note ? `（${extra.note}）` : ""}`]);
}

/** @type {Map<string, import("./lib/lawWatch.mjs").FetchResult>} */
const results = new Map();
for (const url of sources.keys()) {
  results.set(url, await fetchWithRetry(url));
  await new Promise((r) => setTimeout(r, 500)); // 相手のサーバーに負荷をかけない
}

const baseline = readJson(BASELINE_PATH, {});

if (update) {
  const next = {};
  for (const url of [...sources.keys()].sort()) {
    const r = results.get(url);
    if (r?.ok) next[url] = r.snapshot;
    else if (baseline[url]) next[url] = baseline[url]; // 取得できなかったものは据え置く
    else console.error(`取得できず、基準線に入れませんでした: ${url}`);
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`基準線を更新しました（${Object.keys(next).length} 件）: docs/law-watch-baseline.json`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) console.error("基準線がありません。内容を確認したうえで --update で作成してください。");
const report = compareWithBaseline(baseline, sources, results);
const attention = needsAttention(report);
const markdown = buildReportMarkdown(report, new Date().toISOString().slice(0, 10));
console.log(markdown);
if (outPath) writeFileSync(outPath, markdown);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `attention=${attention}\n`);
process.exit(attention ? 3 : 0);
