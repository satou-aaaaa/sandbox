import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { buildScaffold, followUpChecklist, toCamel, toPascal } from "../scripts/lib/scaffold.mjs";

test("toCamel / toPascal", () => {
  assert.equal(toCamel("shokuhin-hanbai"), "shokuhinHanbai");
  assert.equal(toPascal("shokuhin-hanbai"), "ShokuhinHanbai");
  assert.equal(toPascal("abc"), "Abc");
});

test("buildScaffold: 不正な名前・空の名称はエラー", () => {
  assert.throws(() => buildScaffold("Bad_Name", "x"));
  assert.throws(() => buildScaffold("ok-name", "  "));
});

test("buildScaffold: 想定のファイル構成で、JSとして構文が正しい", () => {
  const files = buildScaffold("shokuhin-hanbai", "食品販売業許可");
  assert.deepEqual(Object.keys(files).sort(), [
    "docs/DESIGN_shokuhin-hanbai-core.md",
    "docs/REQUIREMENTS_shokuhin-hanbai-core.md",
    "src/licenses/shokuhin-hanbai/eligibility/engine.js",
    "src/licenses/shokuhin-hanbai/eligibility/kekkaku.js",
    "src/licenses/shokuhin-hanbai/eligibility/types.js",
    "src/licenses/shokuhin-hanbai/index.js",
    "test/shokuhinHanbaiEngine.test.js",
  ]);
  for (const [rel, content] of Object.entries(files)) {
    if (!rel.endsWith(".js")) continue;
    execFileSync(process.execPath, ["--check", "--input-type=module"], { input: content, stdio: ["pipe", "pipe", "pipe"] });
  }
});

test("buildScaffold: 法令根拠の TODO が残り、後続作業の一覧に含まれる", () => {
  const files = buildScaffold("shokuhin-hanbai", "食品販売業許可");
  assert.match(files["src/licenses/shokuhin-hanbai/eligibility/kekkaku.js"], /TODO\(法令根拠\)/);
  assert.ok(followUpChecklist("shokuhin-hanbai", "食品販売業許可").some((s) => s.includes("MODULE_DOCS")));
});
