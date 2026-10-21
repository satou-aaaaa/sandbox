/**
 * ドキュメント整合性の機械検査。新モジュールを追加したのに設計書・要件定義書・
 * AGENTS.mdのディレクトリ構成・ADR索引の更新を忘れる、という陳腐化を検知する。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Linter } from "eslint";
import { REPO_ROOT } from "../scripts/lib/legalBasis.mjs";

const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");
const dirs = (rel) => readdirSync(join(REPO_ROOT, rel), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

/**
 * モジュール（src/ 配下のディレクトリ）→ 設計書・要件定義書のファイル名（docs/ 内。DESIGN_/REQUIREMENTS_ を除いた部分）。
 * 建設業許可は docs/DESIGN.md・docs/REQUIREMENTS.md が対応するため null。
 * 新モジュールを追加したら、ここと設計書・要件定義書を必ず追加すること。
 */
const MODULE_DOCS = {
  "licenses/construction": null,
  "licenses/kobutsu": "kobutsu-core",
  "licenses/sanpai": "sanpai-core",
  "licenses/minpaku": "minpaku-core",
  "licenses/gijinkoku": "gijinkoku-core",
  "licenses/keiei-jiko-shinsa": "keiei-jiko-shinsa-core",
  "licenses/nouchi-tenyo": "nouchi-tenyo-core",
  "licenses/inshokuten-eigyo": "inshokuten-eigyo-core",
  "licenses/tokutei-ginou": "tokutei-ginou-core",
  portal: "uketsuke-portal",
  incorporation: "kaisha-secchi-support",
  succession: "souzoku-support",
};

const licenseModules = dirs("src/licenses").map((d) => `licenses/${d}`);
const domainModules = dirs("src").filter((d) => ["portal", "incorporation", "succession"].includes(d));

test("すべてのモジュールが MODULE_DOCS に登録され、設計書・要件定義書が存在する", () => {
  for (const m of [...licenseModules, ...domainModules]) {
    assert.ok(m in MODULE_DOCS, `${m} が test/docsConsistency.test.js の MODULE_DOCS に未登録`);
    const name = MODULE_DOCS[m];
    if (name === null) continue;
    assert.ok(existsSync(join(REPO_ROOT, `docs/DESIGN_${name}.md`)), `docs/DESIGN_${name}.md が無い`);
    assert.ok(existsSync(join(REPO_ROOT, `docs/REQUIREMENTS_${name}.md`)), `docs/REQUIREMENTS_${name}.md が無い`);
  }
  for (const m of Object.keys(MODULE_DOCS)) {
    assert.ok(existsSync(join(REPO_ROOT, "src", m)), `MODULE_DOCS の ${m} に対応する src/ が無い（削除・改名したなら更新する）`);
  }
});

test("DESIGN_*.md と REQUIREMENTS_*.md が対で存在する", () => {
  const files = readdirSync(join(REPO_ROOT, "docs"));
  const designs = files.filter((f) => f.startsWith("DESIGN_")).map((f) => f.replace("DESIGN_", ""));
  const reqs = files.filter((f) => f.startsWith("REQUIREMENTS_")).map((f) => f.replace("REQUIREMENTS_", ""));
  assert.deepEqual([...designs].sort(), [...reqs].sort());
});

test("AGENTS.md のディレクトリ構成に、すべてのモジュールが載っている", () => {
  const claude = read("AGENTS.md");
  for (const m of [...licenseModules, ...domainModules]) {
    const leaf = m.split("/").pop();
    assert.ok(claude.includes(`${leaf}/`), `AGENTS.md のディレクトリ構成に ${leaf}/ が無い`);
  }
});

test("CLAUDE.md は AGENTS.md を読み込むだけで、本文を二重に持たない", () => {
  // 指示の本文は AGENTS.md（shared-workflows の template/ と同じ形）。agent/ の保護パスは両方を守る。
  assert.match(read("CLAUDE.md"), /^@AGENTS\.md\s*$/m);
  assert.ok(read("AGENTS.md").includes("## 変更してはならない前提"), "AGENTS.md に「変更してはならない前提」の節が無い");
});

test("README.md のモジュール一覧表に、すべてのモジュールの設計書リンクが載っている", () => {
  const readme = read("README.md");
  for (const m of [...licenseModules, ...domainModules]) {
    const name = MODULE_DOCS[m];
    const designDoc = name === null ? "docs/DESIGN.md" : `docs/DESIGN_${name}.md`;
    assert.ok(readme.includes(designDoc), `README.md のモジュール一覧表に ${designDoc} へのリンクが無い（新モジュール追加時はREADME.mdの表も更新すること）`);
  }
});

test("ADRファイルがすべて docs/adr/README.md の一覧に載っている", () => {
  const index = read("docs/adr/README.md");
  const adrs = readdirSync(join(REPO_ROOT, "docs/adr")).filter((f) => /^\d{4}-.+\.md$/.test(f));
  assert.ok(adrs.length > 0);
  for (const f of adrs) assert.ok(index.includes(`(${f})`), `docs/adr/README.md の一覧に ${f} が無い`);
});

test("CHANGELOG.md が存在し、見出しがある", () => {
  assert.match(read("CHANGELOG.md"), /^## /m);
});

/** コード中コメントの docs 参照を探す対象（生成物・依存物は除く）。 */
const CODE_EXT = /\.(?:m?js|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".git", "coverage", "reports", ".stryker-tmp", ".e2e-tmp", "playwright-report", "out", "data"]);

/**
 * コメントの中にあっても実在を求めない、説明用の架空パス。
 * テストの入力値（文字列リテラル）はコメントではないので、ここに足す必要はない。
 * @type {Set<string>}
 */
const FICTIONAL_DOC_PATHS = new Set();

/** @param {string} rel @returns {string[]} REPO_ROOT からの相対パス */
function listCodeFiles(rel = "") {
  /** @type {string[]} */
  const out = [];
  for (const d of readdirSync(join(REPO_ROOT, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(d.name)) continue;
    const p = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...listCodeFiles(p));
    else if (CODE_EXT.test(d.name)) out.push(p);
  }
  return out;
}

/**
 * ソースのコメントから `docs/….md` の参照を取り出す。
 * 文字列・正規表現・テンプレートの中の `//` をコメントと取り違えないよう、
 * 自前の行単位の判定ではなく ESLint（開発依存に既にある）のパーサーでコメントだけを取り出す。
 * @param {string} src
 * @param {"module" | "commonjs"} [sourceType]
 * @returns {{ line: number, path: string }[]}
 */
function findDocRefsInComments(src, sourceType = "module") {
  const linter = new Linter();
  const messages = linter.verify(src, { languageOptions: { ecmaVersion: "latest", sourceType } });
  const fatal = messages.find((m) => m.fatal);
  if (fatal) throw new Error(`構文解析に失敗した（${fatal.line}行目: ${fatal.message}）`);
  /** @type {{ line: number, path: string }[]} */
  const refs = [];
  for (const c of linter.getSourceCode().getAllComments()) {
    const startLine = c.loc?.start.line ?? 1;
    c.value.split("\n").forEach((text, i) => {
      for (const m of text.matchAll(/docs\/[A-Za-z0-9_./-]*?\.md\b/g)) refs.push({ line: startLine + i, path: m[0] });
    });
  }
  return refs;
}

test("findDocRefsInComments はコメント中の参照だけを拾う", () => {
  const src = [
    "/**",
    " * 経緯は`docs/adr/9999-nonexistent.md`参照",
    " */",
    'const fixture = "docs/in-string.md";',
    'const url = "https://example.test/docs/in-url.md";',
    "const re = /\\/\\/docs\\/in-regex.md/;",
    "const tpl = `// docs/in-template.md`;",
    "foo(); // docs/DESIGN.md 7.1節",
    "const x = 1; /* docs/inline-block.md */",
  ].join("\n");
  assert.deepEqual(findDocRefsInComments(src), [
    { line: 2, path: "docs/adr/9999-nonexistent.md" },
    { line: 8, path: "docs/DESIGN.md" },
    { line: 9, path: "docs/inline-block.md" },
  ]);
});

test("コード中コメントの docs/….md 参照が実在する", () => {
  const files = listCodeFiles();
  assert.ok(files.length > 0);
  /** @type {string[]} */
  const missing = [];
  for (const f of files) {
    const sourceType = f.endsWith(".cjs") ? "commonjs" : "module";
    for (const { line, path } of findDocRefsInComments(read(f), sourceType)) {
      if (FICTIONAL_DOC_PATHS.has(path)) continue;
      if (!existsSync(join(REPO_ROOT, path))) missing.push(`${f}:${line} ${path}`);
    }
  }
  assert.deepEqual(missing, [], `存在しない docs 参照（改名したなら参照も直す。説明用の架空パスなら FICTIONAL_DOC_PATHS に足す）:\n${missing.join("\n")}`);
});
