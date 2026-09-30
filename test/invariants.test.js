/**
 * 設計前提（docs/DESIGN.md 1章・CLAUDE.md「変更してはならない前提」）の機械検査。
 * AIレビュアーのプロンプト頼みにせず、CIで決定的に落とすためのテスト。
 *
 * 1. ビルドレス構成: TypeScript/トランスパイラ/ビルドスクリプトを導入していない
 * 2. 外部送信なし: src/ にネットワーク送信APIが無く、Webサーバーは 127.0.0.1 のみで待受
 * 3. 法令根拠: 判定・期限計算ロジックの冒頭コメントに根拠URLがある（既存の未対応分は基準線で許容）
 * 4. データはローカルのJSONのみ: DBライブラリ無し・data/ はコミットされていない
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, collectLegalBasis, toRepoPath, walkFiles } from "../scripts/lib/legalBasis.mjs";

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const srcFiles = walkFiles(join(REPO_ROOT, "src")).filter((f) => f.endsWith(".js"));

test("ビルドレス: .ts ファイルとビルド用の依存・スクリプトが無い", () => {
  const tsFiles = walkFiles(REPO_ROOT)
    .map(toRepoPath)
    .filter((p) => /\.(ts|tsx|mts|cts)$/.test(p) && !p.endsWith(".d.ts") && !p.startsWith("node_modules/") && !p.includes("/node_modules/"));
  assert.deepEqual(tsFiles, [], "TypeScriptのソースを追加しない（ADR-0001）");
  const banned = allDeps.filter((d) => /^(ts-node|tsx|esbuild|@swc\/|@babel\/|babel-|webpack|rollup|vite|parcel|tsup)/.test(d));
  assert.deepEqual(banned, [], "トランスパイラ/バンドラを導入しない");
  assert.equal(pkg.scripts.build, undefined, "build スクリプトを置かない");
});

test("外部送信なし: src/ にネットワーク送信APIを使うコードが無い", () => {
  // Webサーバー（src/web/server.js）は node:http で待受するだけなので、送信側のAPI（request/get・https 等）だけを検出する
  const pattern = /\bfetch\s*\(|node:https\b|node:net\b|node:dgram|node:tls|node:http2|\bXMLHttpRequest\b|\bWebSocket\b|\bhttps?\.(request|get)\s*\(|require\(["'](https?|net)["']\)/;
  const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const offenders = srcFiles.filter((f) => pattern.test(stripComments(readFileSync(f, "utf8")))).map(toRepoPath);
  assert.deepEqual(offenders, [], "個人情報・財務情報を外部へ送信しない（DESIGN.md 1章）");
});

test("Webサーバーは 127.0.0.1 のみで待受し、0.0.0.0 等を指定しない", () => {
  const server = readFileSync(join(REPO_ROOT, "src/web/server.js"), "utf8");
  assert.match(server, /\.listen\(\s*port\s*,\s*"127\.0\.0\.1"/);
  const offenders = [...srcFiles, ...walkFiles(join(REPO_ROOT, "scripts"))]
    .filter((f) => /0\.0\.0\.0|"::"|'::'/.test(readFileSync(f, "utf8")))
    .map(toRepoPath);
  assert.deepEqual(offenders, []);
});

test("データベースを導入していない（単一JSONファイル永続化。ADR-0003）", () => {
  const banned = allDeps.filter((d) => /^(sqlite|better-sqlite|sql\.js|pg$|mysql|mongodb|mongoose|prisma|@prisma|typeorm|sequelize|knex|redis|ioredis|lowdb|nedb)/.test(d));
  assert.deepEqual(banned, []);
});

test("data/ 配下（実データ）がGit管理されていない（NFR-5）", (t) => {
  let tracked;
  try {
    tracked = execFileSync("git", ["ls-files", "data"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    t.skip("git が使えない環境");
    return;
  }
  assert.equal(tracked, "");
});

test("法令根拠: 判定・期限計算ロジックの冒頭コメントに根拠URLがある（既存の未対応分は基準線で許容）", () => {
  const baseline = JSON.parse(readFileSync(join(REPO_ROOT, "test/fixtures/legal-basis-baseline.json"), "utf8")).files;
  const exempt = Object.keys(JSON.parse(readFileSync(join(REPO_ROOT, "test/fixtures/legal-basis-exempt.json"), "utf8")).files);
  const missing = [...collectLegalBasis()].filter(([, urls]) => urls.length === 0).map(([p]) => p);
  const fresh = missing.filter((p) => !baseline.includes(p) && !exempt.includes(p));
  assert.deepEqual(fresh, [], "新規・変更したロジックには、根拠となる法令・公式情報源のURLをファイル冒頭コメントに記載する（DESIGN.md 1章）。基準線への追加で逃げない");
});

test("法令根拠の基準線に、存在しないファイルが残っていない", () => {
  const known = new Set([...collectLegalBasis()].map(([p]) => p));
  const baseline = JSON.parse(readFileSync(join(REPO_ROOT, "test/fixtures/legal-basis-baseline.json"), "utf8")).files;
  assert.deepEqual(baseline.filter((p) => !known.has(p)), [], "削除・改名したファイルは基準線からも消す");
});

test("法令根拠の免除リスト: 理由が書かれ、存在するファイルで、根拠URLを持たない", () => {
  const exempt = JSON.parse(readFileSync(join(REPO_ROOT, "test/fixtures/legal-basis-exempt.json"), "utf8")).files;
  const basis = collectLegalBasis();
  for (const [file, reason] of Object.entries(exempt)) {
    assert.ok(basis.has(file), `${file} は判定・期限計算ロジックの対象として存在しない（削除・改名したなら免除リストからも消す）`);
    assert.ok(typeof reason === "string" && reason.length >= 10, `${file} の免除理由を書く`);
    assert.deepEqual(basis.get(file), [], `${file} に根拠URLが付いたので、免除リストから外す`);
  }
});

test("雛形（scripts/scaffold-module.mjs）の TODO(法令根拠) が src/ と docs/ に残っていない", () => {
  const offenders = [...srcFiles, ...walkFiles(join(REPO_ROOT, "docs")).filter((f) => f.endsWith(".md"))]
    .filter((f) => readFileSync(f, "utf8").includes("TODO(法令根拠)"))
    .map(toRepoPath);
  assert.deepEqual(offenders, [], "雛形の法令根拠TODOは、原文を確認したURLで置き換える");
});
