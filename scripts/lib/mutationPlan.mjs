/**
 * ミューテーションテスト（Stryker）を、モジュールごとの組（シャード）に分ける計画を作る。
 *
 * 【なぜ分けるか】command runner は coverageAnalysis: "off" のため、ミュータント1件ごとに
 * テストを丸ごと流す。全体（3251件 × 全テスト約10秒）では1つのジョブで約7時間かかり、
 * 週次の実行が2時間の上限で毎回止まっていた（2026-10。shared-workflows incidents 参照）。
 * そこで、変えるファイルをモジュールごとに分けて別々のジョブで並べて流し、
 * 各組では「その組のファイルを import でたどって使うテストファイル」だけを流す。
 *
 * 【テストの選び方】テストファイルから相対 import（静的・動的）をたどり、組のファイルに
 * 届くものを選ぶ。CLI を子プロセスで起動するテストのために、テスト中の文字列に書かれた
 * `scripts/…js`・`src/…js` のパスもたどる。ファイルを文字列として読むだけのテスト
 * （文書の整合など）はミュータントを殺せないので、外れても結果は変わらない。
 *
 * 参照: https://stryker-mutator.io/docs/stryker-js/configuration/ （mutate・commandRunner）
 *       https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations （matrix）
 */
import { existsSync, readFileSync, globSync } from "node:fs";
import path from "node:path";

const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*["'](\.{1,2}\/[^"']+)["']|(?:^|[\s;(])import\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)|(?:^|[\s;])import\s*["'](\.{1,2}\/[^"']+)["']/gm;
const PATH_LITERAL_RE = /["'`](?:\.\/)?((?:scripts|src)\/[\w./-]+\.m?js)["'`]/g;

/**
 * 変えるファイルの組の名前。src/licenses/<名前>/… は <名前>、src/core/<名前>/… は core-<名前>、
 * それ以外の src/<名前>/… は <名前>。
 * @param {string} file リポジトリの一番上からの相対パス（区切りは /）
 * @returns {string}
 */
export function shardNameOf(file) {
  const parts = file.split("/");
  if (parts[0] !== "src" || parts.length < 3) return "other";
  if (parts[1] === "licenses") return parts[2];
  if (parts[1] === "core") return `core-${parts[2]}`;
  return parts[1];
}

/**
 * あるファイルから、import と文字列のパスでたどれるファイルをすべて返す（自分を含む）。
 * @param {string} start
 * @param {(p: string) => string | null} read ファイルの中身（無ければ null）
 * @param {Map<string, Set<string>>} [memo]
 * @returns {Set<string>}
 */
export function reachableFiles(start, read, memo = new Map()) {
  const seen = new Set();
  const stack = [start];
  while (stack.length > 0) {
    const f = /** @type {string} */ (stack.pop());
    if (seen.has(f)) continue;
    seen.add(f);
    const cached = memo.get(f);
    if (cached) {
      for (const d of cached) stack.push(d);
      continue;
    }
    const text = read(f);
    if (text === null) continue;
    for (const m of text.matchAll(IMPORT_RE)) {
      stack.push(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1] ?? m[2] ?? m[3])));
    }
    // 子プロセスで動かす CLI など、文字列で書かれたパス（リポジトリの一番上から）
    for (const m of text.matchAll(PATH_LITERAL_RE)) stack.push(path.posix.normalize(m[1]));
  }
  return seen;
}

/**
 * @typedef {{name: string, mutate: string[], tests: string[]}} Shard
 */

/** 1つの組に入れるファイルの上限。大きいモジュールは -1・-2 … に分ける（1組を1時間以内に収めるため）。 */
export const MAX_FILES_PER_SHARD = 8;

/**
 * @param {string[]} mutateFiles 変えるファイル（展開済み）
 * @param {string[]} testFiles テストファイル
 * @param {(p: string) => string | null} read
 * @param {number} [maxFiles]
 * @returns {Shard[]} 名前順。テストが1つも届かない組も tests: [] で返す（呼ぶ側で止める）
 */
export function planShards(mutateFiles, testFiles, read, maxFiles = MAX_FILES_PER_SHARD) {
  /** @type {Map<string, string[]>} */
  const modules = new Map();
  for (const f of [...new Set(mutateFiles)].sort()) {
    const name = shardNameOf(f);
    modules.set(name, [...(modules.get(name) ?? []), f]);
  }
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const [name, files] of modules) {
    const n = Math.ceil(files.length / maxFiles);
    // ファイルを均等に配る（8・1 ではなく 5・4 に近づける）
    for (let i = 0; i < n; i++) groups.set(n === 1 ? name : `${name}-${i + 1}`, files.filter((_, j) => j % n === i));
  }
  const memo = new Map();
  const reach = new Map(testFiles.map((t) => [t, reachableFiles(t, read, memo)]));
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, mutate]) => ({
      name,
      mutate,
      tests: testFiles.filter((t) => mutate.some((f) => reach.get(t)?.has(f))).sort(),
    }));
}

/**
 * stryker.config.mjs の mutate（glob）とテストファイルから計画を作る。
 * @param {{mutate: string[]}} config
 * @param {string} [cwd]
 * @returns {Shard[]}
 */
export function planFromConfig(config, cwd = process.cwd()) {
  const mutateFiles = config.mutate.flatMap((g) => globSync(g, { cwd })).map((p) => p.split(path.sep).join("/"));
  const testFiles = globSync("test/**/*.test.{js,mjs}", { cwd }).map((p) => p.split(path.sep).join("/")).sort();
  const read = (/** @type {string} */ p) => {
    const abs = path.join(cwd, p);
    try {
      return existsSync(abs) ? readFileSync(abs, "utf8") : null;
    } catch {
      return null; // ディレクトリなど
    }
  };
  return planShards(mutateFiles, testFiles, read);
}
