import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
  branchNameForIssue,
  buildAgentEnv,
  buildPrompt,
  findProtectedPaths,
  isEligibleIssue,
} from "../agent/policy.js";

const issue = (over = {}) => ({
  number: 1,
  title: "t",
  body: "b",
  author: { login: "satou-aaaaa" },
  labels: [{ name: "agent-ready" }],
  ...over,
});

test("isEligibleIssue: 所有者起票かつ agent-ready のみ対象", () => {
  assert.equal(isEligibleIssue(issue()), true);
});

test("isEligibleIssue: 第三者が起票したIssueは対象外（プロンプトインジェクション対策）", () => {
  assert.equal(isEligibleIssue(issue({ author: { login: "someone-else" } })), false);
});

test("isEligibleIssue: 処理中・完了済みは対象外", () => {
  assert.equal(isEligibleIssue(issue({ labels: [{ name: "agent-ready" }, { name: "agent-working" }] })), false);
  assert.equal(isEligibleIssue(issue({ labels: [{ name: "agent-ready" }, { name: "agent-done" }] })), false);
});

test("isEligibleIssue: agent-ready が無ければ対象外", () => {
  assert.equal(isEligibleIssue(issue({ labels: [] })), false);
});

test("findProtectedPaths: CI・フック・依存定義・実データ・秘密情報を検出する", () => {
  const hits = findProtectedPaths([
    "src/core/eligibility/x.js",
    ".github/workflows/test.yml",
    "agent/run.mjs",
    "hooks/check-secrets.mjs",
    "package.json",
    "package-lock.json",
    "data/clients.json",
    ".env",
    "config/.env.local",
    "CLAUDE.md",
  ]);
  assert.deepEqual(hits, [
    ".github/workflows/test.yml",
    "agent/run.mjs",
    "hooks/check-secrets.mjs",
    "package.json",
    "package-lock.json",
    "data/clients.json",
    ".env",
    "config/.env.local",
    "CLAUDE.md",
  ]);
});

test("findProtectedPaths: 通常のソース・テスト・docsは保護対象でない", () => {
  assert.deepEqual(findProtectedPaths(["src/a.js", "test/a.test.js", "docs/x.md", "docs/agent/x.md"]), []);
});

test("findProtectedPaths: Windows区切り・./接頭辞でも検出する", () => {
  assert.deepEqual(findProtectedPaths([".github\\workflows\\a.yml", "./package.json"]), [".github/workflows/a.yml", "package.json"]);
});

test("branchNameForIssue", () => {
  assert.equal(branchNameForIssue(81), "agent/issue-81");
});

test("ALLOWED_TOOLS は push・gh・ネットワークを含まない", () => {
  const joined = ALLOWED_TOOLS.join(" ");
  assert.doesNotMatch(joined, /push|gh |curl|wget|Web/);
});

test("DISALLOWED_TOOLS は push・gh・ネットワークと保護パスの編集を明示禁止する", () => {
  for (const must of ["WebFetch", "WebSearch", "Bash(git push*)", "Bash(gh *)", "Edit(/.github/**)", "Edit(/agent/**)", "Edit(/package.json)"]) {
    assert.ok(DISALLOWED_TOOLS.includes(must), `${must} が禁止されていません`);
  }
});

test("buildAgentEnv: GitHub認証情報を引き継がない", () => {
  const env = buildAgentEnv({ PATH: "/bin", ANTHROPIC_API_KEY: "k", GH_TOKEN: "x", GITHUB_TOKEN: "y", GH_HOST: "h" });
  assert.deepEqual(env, { PATH: "/bin", ANTHROPIC_API_KEY: "k" });
});

test("buildPrompt: Issue本文を区切ってデータとして渡し、禁止事項を含む", () => {
  const p = buildPrompt(issue({ number: 7, title: "件名", body: "本文" }));
  assert.match(p, /Issue #7/);
  assert.match(p, /<issue-title>件名<\/issue-title>/);
  assert.match(p, /<issue-body>\n本文\n<\/issue-body>/);
  assert.match(p, /コミット・push・PR作成/);
});
