/**
 * ドキュメント整合性の機械検査。新モジュールを追加したのに設計書・要件定義書・
 * CLAUDE.mdのディレクトリ構成・ADR索引の更新を忘れる、という陳腐化を検知する。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

test("CLAUDE.md のディレクトリ構成に、すべてのモジュールが載っている", () => {
  const claude = read("CLAUDE.md");
  for (const m of [...licenseModules, ...domainModules]) {
    const leaf = m.split("/").pop();
    assert.ok(claude.includes(`${leaf}/`), `CLAUDE.md のディレクトリ構成に ${leaf}/ が無い`);
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
