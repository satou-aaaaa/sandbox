#!/usr/bin/env node
/**
 * CI の「npm audit（高深刻度以上）」の判定（判定の考え方は scripts/lib/auditGate.mjs の冒頭）。
 *
 * 使い方:
 *   node scripts/audit-gate.mjs                      木全体で判定（main の push・Nightly・手元）
 *   node scripts/audit-gate.mjs --base origin/main   PR 用。base の lockfile にも同じ脆弱性があれば、この PR のせいではないので落とさない
 *   --level <深刻度>  既定は high（moderate・critical など）
 *
 * 終了コード: 0 = 通す、1 = level 以上の脆弱性を持ち込んでいる、2 = npm audit を実行できない（落とす側に倒す）。
 * base 側の npm audit が読めないときは、全部を「持ち込んだもの」として扱う（黙って通さない）。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { advisoriesAtOrAbove, formatAdvisory, judge } from "./lib/auditGate.mjs";

const args = process.argv.slice(2);
/** @param {string} name */
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const level = /** @type {import("./lib/auditGate.mjs").Severity} */ (opt("--level") ?? "high");
const baseRef = opt("--base");

/**
 * @param {string} cwd
 * @returns {unknown}
 */
function audit(cwd) {
  // npm audit は脆弱性があると終了コード1を返すので、終了コードではなく JSON で判定する
  const r = spawnSync("npm", ["audit", "--json", "--package-lock-only"], { cwd, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(`npm audit の結果を読めません（${cwd}）: ${(r.stderr || r.stdout || "").slice(0, 500)}`);
  }
}

/**
 * base の package.json・package-lock.json を一時フォルダに出して audit する。
 * @param {string} ref
 */
function auditBase(ref) {
  const dir = mkdtempSync(path.join(tmpdir(), "audit-base-"));
  try {
    for (const f of ["package.json", "package-lock.json"]) {
      writeFileSync(path.join(dir, f), execFileSync("git", ["show", `${ref}:${f}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
    }
    return advisoriesAtOrAbove(audit(dir), level);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let head;
try {
  head = advisoriesAtOrAbove(audit(process.cwd()), level);
} catch (e) {
  console.log(`::error::${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}

let base = null;
if (baseRef) {
  try {
    base = auditBase(baseRef);
  } catch (e) {
    console.log(`::warning::基準（${baseRef}）の npm audit を読めないので、全部をこの変更が持ち込んだものとして判定します: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const { introduced, existing } = judge(head, base);
for (const a of existing) {
  console.log(`::warning::${baseRef} にも前からある脆弱性（この PR のせいではないので止めません。main の Test・Nightly が落ちて ci-failure の Issue になるので、そちらで直す。直し方は docs/DEPENDENCY_OVERRIDES.md）: ${formatAdvisory(a)}`);
}
if (introduced.length === 0) {
  console.log(`npm audit: ${level} 以上で${baseRef ? "この変更が持ち込んだ" : ""}脆弱性はありません（前からあるもの ${existing.length} 件）`);
  process.exit(0);
}
for (const a of introduced) {
  console.log(`::error::${baseRef ? "この変更が持ち込んだ" : ""}${level} 以上の脆弱性: ${formatAdvisory(a)}`);
}
console.log("直し方: npm audit fix で直らないとき（上流が古い版を指定しているとき）は docs/DEPENDENCY_OVERRIDES.md の手順で overrides に足す");
process.exit(1);
