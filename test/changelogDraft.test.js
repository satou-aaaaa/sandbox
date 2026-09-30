import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChangelogDraft, parseSubject } from "../scripts/lib/changelogDraft.mjs";

test("parseSubject: 接頭辞とPR番号を分ける", () => {
  assert.deepEqual(parseSubject("feat: 追加する (#12)"), { category: "feat", text: "追加する", pr: "12" });
  assert.deepEqual(parseSubject("fix(web): 直す"), { category: "fix", text: "直す", pr: null });
  assert.deepEqual(parseSubject("接頭辞なしの件名"), { category: "other", text: "接頭辞なしの件名", pr: null });
  assert.equal(parseSubject("unknown: x").category, "other");
});

test("buildChangelogDraft: 分類・重複除去・除外・PRリンク", () => {
  const md = buildChangelogDraft(
    ["feat: A (#1)", "fix: B (#2) (#3)", "feat: A (#1)", "Merge pull request #9", "chore(deps): bump x", "Bump y from 1 to 2", "docs: C"],
    { title: "T", repo: "o/r" },
  );
  assert.match(md, /^## T/);
  assert.match(md, /### 機能追加\n\n- A \(\[#1\]\(https:\/\/github\.com\/o\/r\/pull\/1\)\)/);
  assert.match(md, /- B \(\[#3\]/);
  assert.match(md, /### ドキュメント\n\n- C\n/);
  assert.equal((md.match(/- A /g) ?? []).length, 1);
  assert.doesNotMatch(md, /Merge|bump|Bump/);
});

test("buildChangelogDraft: 対象が無ければその旨を出す", () => {
  assert.match(buildChangelogDraft([], { title: "T" }), /変更はありません/);
});
