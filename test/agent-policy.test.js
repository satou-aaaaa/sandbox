import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  ALLOWED_TOOLS,
  DAILY_LIMITS,
  buildRetryPrompt,
  checkDailyBudget,
  decideToolUse,
  normalizeState,
  recordRun,
  truncateTail,
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

const CWD = path.resolve("/tmp/kkt-work/issue-1");

test("decideToolUse: 作業ツリー内の通常ファイルの編集は許可する", () => {
  assert.equal(decideToolUse("Edit", { file_path: path.join(CWD, "src/a.js") }, CWD).decision, "allow");
  assert.equal(decideToolUse("Write", { file_path: "test/a.test.js" }, CWD).decision, "allow");
});

test("decideToolUse: 保護パスの編集を拒否する", () => {
  assert.equal(decideToolUse("Edit", { file_path: path.join(CWD, ".github/workflows/test.yml") }, CWD).decision, "deny");
  assert.equal(decideToolUse("Write", { file_path: "agent/policy.js" }, CWD).decision, "deny");
  assert.equal(decideToolUse("Edit", { file_path: "package.json" }, CWD).decision, "deny");
});

test("decideToolUse: 作業ディレクトリ外への書き込み・参照（パストラバーサル含む）を拒否する", () => {
  assert.equal(decideToolUse("Write", { file_path: "../other/x.js" }, CWD).decision, "deny");
  assert.equal(decideToolUse("Write", { file_path: path.resolve("/etc/passwd") }, CWD).decision, "deny");
  assert.equal(decideToolUse("Read", { file_path: "../../.ssh/id_rsa" }, CWD).decision, "deny");
});

test("decideToolUse: .env・秘密鍵の参照を拒否する", () => {
  assert.equal(decideToolUse("Read", { file_path: ".env" }, CWD).decision, "deny");
  assert.equal(decideToolUse("Read", { file_path: "keys/server.pem" }, CWD).decision, "deny");
  assert.equal(decideToolUse("Read", { file_path: "src/a.js" }, CWD).decision, "allow");
});

test("decideToolUse: Bashのネットワーク・push・依存追加・コマンド置換を拒否し、テスト実行は許可する", () => {
  for (const cmd of ["curl https://x", "wget x", "git push origin main", "gh pr merge 1", "npm install foo", "npm publish", "npx foo", "echo $(cat /etc/passwd)", "echo `id`", "npm test && curl x"]) {
    assert.equal(decideToolUse("Bash", { command: cmd }, CWD).decision, "deny", cmd);
  }
  for (const cmd of ["npm test", "npm run lint", "node --test test/a.test.js", "git diff --stat", "git status"]) {
    assert.equal(decideToolUse("Bash", { command: cmd }, CWD).decision, "allow", cmd);
  }
});

test("decideToolUse: パス未指定の書き込みは拒否する", () => {
  assert.equal(decideToolUse("Edit", {}, CWD).decision, "deny");
});

test("日次上限: 別日・破損した状態は新規扱いになる", () => {
  assert.deepEqual(normalizeState({ date: "2026-09-28", runs: 9, costUsd: 99 }, "2026-09-29"), { date: "2026-09-29", runs: 0, costUsd: 0 });
  assert.deepEqual(normalizeState(null, "2026-09-29"), { date: "2026-09-29", runs: 0, costUsd: 0 });
  assert.deepEqual(normalizeState({ date: "2026-09-29", runs: "x", costUsd: 1 }, "2026-09-29"), { date: "2026-09-29", runs: 0, costUsd: 0 });
});

test("日次上限: 件数・費用の上限に達すると許可されない", () => {
  const base = { date: "d", runs: 0, costUsd: 0 };
  assert.equal(checkDailyBudget(base).allowed, true);
  assert.equal(checkDailyBudget({ ...base, runs: DAILY_LIMITS.maxRuns }).allowed, false);
  assert.equal(checkDailyBudget({ ...base, costUsd: DAILY_LIMITS.maxCostUsd }).allowed, false);
  assert.equal(checkDailyBudget({ ...base, costUsd: DAILY_LIMITS.maxCostUsd - 0.01 }).allowed, true);
});

test("recordRun: 元の状態を変更せず加算し、不正な費用は0として扱う", () => {
  const s = { date: "d", runs: 1, costUsd: 1 };
  assert.deepEqual(recordRun(s, 0.5), { date: "d", runs: 2, costUsd: 1.5 });
  assert.deepEqual(s, { date: "d", runs: 1, costUsd: 1 });
  assert.equal(recordRun(s, NaN).costUsd, 1);
});

test("truncateTail / buildRetryPrompt: 長い出力は末尾のみ渡し、失敗コマンドと禁止事項の継続を含む", () => {
  assert.equal(truncateTail("abc", 10), "abc");
  const long = "x".repeat(5000) + "END";
  const out = truncateTail(long, 100);
  assert.ok(out.endsWith("END") && out.length < 200);
  const p = buildRetryPrompt("npm test", "失敗ログ");
  assert.match(p, /`npm test`/);
  assert.match(p, /<verification-output>\n失敗ログ\n<\/verification-output>/);
  assert.match(p, /禁止事項が引き続き適用/);
});
