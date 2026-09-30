/**
 * 法令根拠URLの抽出・判定対象ファイルの列挙（設計前提3「法令根拠を明記する」の機械検査用）。
 *
 * test/invariants.test.js（根拠URLの記載漏れ検知）と scripts/law-watch.mjs（根拠URLの変更検知）が
 * 共有する。ファイルを読み取るだけで、外部への通信は行わない。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** リポジトリのルート。 */
export const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** 根拠URLを探す先頭行数（ファイル冒頭コメントの範囲）。 */
export const HEADER_LINES = 60;

/** 判定・期限計算ロジックとして根拠URLを要求するディレクトリ（`src/` からの相対。区切りは `/`）。 */
const LOGIC_DIR_PATTERN = /^src\/(licenses\/[^/]+\/(eligibility|reminders)|incorporation\/reminders|portal\/reminders|succession\/(heirs|reminders))\//;

/** 根拠URLを要求しないファイル名（型定義・集約・免責文言のみ・入力の整合性チェック等）。 */
const EXEMPT_BASENAMES = new Set(["types.js", "engine.js", "disclaimer.js", "consistencyChecks.js"]);

/**
 * @param {string} dir
 * @returns {string[]} 配下の全ファイル（絶対パス）
 */
export function walkFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * @param {string} absPath
 * @returns {string} リポジトリルートからの相対パス（`/` 区切り）
 */
export function toRepoPath(absPath) {
  return relative(REPO_ROOT, absPath).split(sep).join("/");
}

/**
 * 根拠URLの記載を要求する判定・期限計算ロジックのファイルを列挙する。
 * @returns {string[]} リポジトリルートからの相対パス（昇順）
 */
export function listLogicFiles() {
  return walkFiles(join(REPO_ROOT, "src"))
    .map(toRepoPath)
    .filter((p) => p.endsWith(".js") && LOGIC_DIR_PATTERN.test(p) && !EXEMPT_BASENAMES.has(p.split("/").pop() ?? ""))
    .sort();
}

/**
 * ファイル冒頭から http(s) のURLを抽出する。末尾の句読点・括弧は除く。
 * @param {string} source ファイルの内容
 * @returns {string[]} 重複除去済みのURL
 */
export function extractHeaderUrls(source) {
  const head = source.split(/\r?\n/).slice(0, HEADER_LINES).join("\n");
  const urls = head.match(/https?:\/\/[^\s)）」』>"'`]+/g) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[.,、。;；:：]+$/, "")))];
}

/**
 * ロジックファイルごとの根拠URLを集める。
 * @returns {Map<string, string[]>} 相対パス → URL一覧（URLが無ければ空配列）
 */
export function collectLegalBasis() {
  /** @type {Map<string, string[]>} */
  const result = new Map();
  for (const rel of listLogicFiles()) {
    result.set(rel, extractHeaderUrls(readFileSync(join(REPO_ROOT, rel), "utf8")));
  }
  return result;
}
