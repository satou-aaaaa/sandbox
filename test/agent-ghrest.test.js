import { test } from "node:test";
import assert from "node:assert/strict";
import { createGhRest, parseArgs } from "../agent/gh-rest.mjs";
import { resolveAuth } from "../agent/policy.js";

const R = "o/r";

/**
 * 模擬のREST API。`routes` は「メソッド パス（クエリ含む）→ 応答」。未登録は例外。呼び出しを calls に記録する。
 * @param {Record<string, any>} routes
 */
function fake(routes = {}) {
  const calls = [];
  const api = (method, path, body, opts) => {
    calls.push({ method, path, body, opts });
    const key = `${method} ${path}`;
    if (key in routes) {
      const v = routes[key];
      if (v instanceof Error) throw v;
      return typeof v === "function" ? v(body) : v;
    }
    throw new Error(`未登録のREST呼び出し: ${key}`);
  };
  return { api, calls, gh: createGhRest({ api, repo: R }) };
}

const issue = (over = {}) => ({ number: 1, title: "t", body: "b", state: "open", user: { login: "satou-aaaaa" }, labels: [{ name: "agent-ready" }], created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T01:00:00Z", html_url: "https://github.com/o/r/issues/1", ...over });

test("parseArgs: 値を取るオプションは複数回指定でき、それ以外は真偽のフラグ", () => {
  const { positional, opts, flags } = parseArgs(["5", "--repo", "o/r", "--add-label", "a", "--add-label", "b", "--force"], ["--repo", "--add-label"]);
  assert.deepEqual(positional, ["5"]);
  assert.deepEqual(opts["--add-label"], ["a", "b"]);
  assert.equal(opts["--repo"][0], "o/r");
  assert.ok(flags.has("--force"));
});

test("issue list: ラベルで絞り込み、PRを除き、--json の項目だけを返す（ghと同じ形）", () => {
  const { gh, calls } = fake({
    [`GET repos/${R}/issues?state=open&labels=agent-ready&per_page=100&page=1`]: [issue({ number: 5 }), issue({ number: 6, pull_request: {} }), issue({ number: 7 })],
  });
  const out = JSON.parse(gh(["issue", "list", "--repo", R, "--state", "open", "--label", "agent-ready", "--json", "number,title,author,labels", "--limit", "50"]));
  assert.deepEqual(out.map((i) => i.number), [5, 7]);
  assert.deepEqual(Object.keys(out[0]).sort(), ["author", "labels", "number", "title"]);
  assert.deepEqual(out[0].author, { login: "satou-aaaaa" });
  assert.deepEqual(out[0].labels, [{ name: "agent-ready" }]);
  assert.equal(calls.length, 1);
});

test("issue list: --limit の件数までに絞る", () => {
  const items = Array.from({ length: 10 }, (_, i) => issue({ number: i + 1 }));
  const { gh } = fake({ [`GET repos/${R}/issues?state=all&per_page=100&page=1`]: items });
  assert.equal(JSON.parse(gh(["issue", "list", "--repo", R, "--state", "all", "--json", "number", "--limit", "3"])).length, 3);
});

test("issue view: state は大文字、--jq .state は文字列、comments は別に取得する", () => {
  const { gh } = fake({
    [`GET repos/${R}/issues/9`]: issue({ number: 9, state: "closed" }),
    [`GET repos/${R}/issues/9/comments?per_page=100&page=1`]: [{ body: "こんにちは", user: { login: "satou-aaaaa" }, created_at: "2026-09-30T00:00:00Z" }],
  });
  assert.equal(gh(["issue", "view", "9", "--repo", R, "--json", "state", "--jq", ".state"]), "CLOSED");
  const v = JSON.parse(gh(["issue", "view", "9", "--repo", R, "--json", "comments"]));
  assert.deepEqual(v.comments, [{ body: "こんにちは", author: { login: "satou-aaaaa" }, createdAt: "2026-09-30T00:00:00Z" }]);
});

test("issue create: タイトル・本文・ラベルを作成し、URLを返す", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/issues`]: issue({ html_url: "https://github.com/o/r/issues/42" }) });
  const url = gh(["issue", "create", "--repo", R, "--title", "題", "--body", "本文", "--label", "a", "--label", "b"]);
  assert.equal(url, "https://github.com/o/r/issues/42");
  assert.deepEqual(calls[0].body, { title: "題", body: "本文", labels: ["a", "b"] });
});

test("issue edit: 追加は一括、削除は1つずつ。付いていないラベルの削除（404）は無視する", () => {
  const notFound = Object.assign(new Error("x"), { stderr: "HTTP 404: Label does not exist" });
  const { gh, calls } = fake({
    [`DELETE repos/${R}/issues/3/labels/agent-working`]: null,
    [`DELETE repos/${R}/issues/3/labels/agent-ready`]: notFound,
    [`POST repos/${R}/issues/3/labels`]: [],
  });
  gh(["issue", "edit", "3", "--repo", R, "--remove-label", "agent-working", "--remove-label", "agent-ready", "--add-label", "agent-done"]);
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [`DELETE repos/${R}/issues/3/labels/agent-working`, `DELETE repos/${R}/issues/3/labels/agent-ready`, `POST repos/${R}/issues/3/labels`]);
  assert.deepEqual(calls[2].body, { labels: ["agent-done"] });
});

test("issue edit: 404以外の削除エラーは握りつぶさない", () => {
  const boom = Object.assign(new Error("x"), { stderr: "HTTP 500" });
  const { gh } = fake({ [`DELETE repos/${R}/issues/3/labels/a`]: boom });
  assert.throws(() => gh(["issue", "edit", "3", "--repo", R, "--remove-label", "a"]));
});

test("issue close / reopen: 理由の対応（not planned → not_planned）とコメント", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/issues/4/comments`]: {}, [`PATCH repos/${R}/issues/4`]: {} });
  gh(["issue", "close", "4", "--repo", R, "--reason", "not planned", "--comment", "閉じます"]);
  assert.deepEqual(calls[0].body, { body: "閉じます" });
  assert.deepEqual(calls[1].body, { state: "closed", state_reason: "not_planned" });
  gh(["issue", "close", "4", "--repo", R, "--reason", "completed"]);
  assert.equal(calls[2].body.state_reason, "completed");
  gh(["issue", "reopen", "4", "--repo", R]);
  assert.deepEqual(calls[3].body, { state: "open", state_reason: "reopened" });
});

test("label create: 既に存在する場合（422）は更新する", () => {
  const exists = Object.assign(new Error("x"), { stderr: "HTTP 422: already_exists" });
  const { gh, calls } = fake({ [`POST repos/${R}/labels`]: exists, [`PATCH repos/${R}/labels/agent-x`]: {} });
  gh(["label", "create", "agent-x", "--repo", R, "--color", "fbca04", "--description", "説明", "--force"]);
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].body.color, "fbca04");
});

const pr = (over = {}) => ({ number: 10, title: "agent: t", body: "Closes #1", state: "closed", merged_at: "2026-09-30T02:00:00Z", head: { ref: "agent/issue-1", sha: "abc" }, base: { ref: "main" }, draft: false, labels: [{ name: "agent-authored" }], user: { login: "satou-aaaaa" }, created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T02:00:00Z", merge_commit_sha: "deadbeef", html_url: "https://github.com/o/r/pull/10", ...over });

test("pr list --state merged: マージ済みだけ、ラベルで絞り、headRefName・mergedAt を返す", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls?state=closed&per_page=100&page=1`]: [pr({ number: 10 }), pr({ number: 11, merged_at: null }), pr({ number: 12, labels: [] })],
  });
  const out = JSON.parse(gh(["pr", "list", "--repo", R, "--state", "merged", "--label", "agent-authored", "--json", "number,headRefName,mergedAt", "--limit", "20"]));
  assert.deepEqual(out, [{ number: 10, headRefName: "agent/issue-1", mergedAt: "2026-09-30T02:00:00Z" }]);
});

test("pr list --head: ブランチ名で絞る（owner:branch）", () => {
  const { gh, calls } = fake({ [`GET repos/${R}/pulls?state=closed&head=o%3Aagent%2Fissue-7&per_page=100&page=1`]: [] });
  assert.deepEqual(JSON.parse(gh(["pr", "list", "--repo", R, "--head", "agent/issue-7", "--state", "merged", "--json", "number"])), []);
  assert.ok(calls[0].path.includes("head=o%3Aagent%2Fissue-7"));
});

test("pr list --json mergedBy: マージ者を個別に取得し、botかどうかを返す", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls?state=closed&per_page=100&page=1`]: [pr({ number: 10 })],
    [`GET repos/${R}/pulls/10`]: pr({ number: 10, merged_by: { login: "github-actions[bot]", type: "Bot" } }),
  });
  const out = JSON.parse(gh(["pr", "list", "--repo", R, "--state", "merged", "--json", "number,mergedBy"]));
  assert.deepEqual(out[0].mergedBy, { login: "github-actions[bot]", is_bot: true });
});

test("pr list --json statusCheckRollup: check-runs と status を、ghと同じ形（大文字）にまとめる", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls?state=open&per_page=100&page=1`]: [pr({ number: 20, state: "open", merged_at: null })],
    [`GET repos/${R}/commits/abc/check-runs?per_page=100&page=1`]: { check_runs: [{ name: "test (ubuntu-latest, 22.x)", status: "completed", conclusion: "success" }, { name: "CodeQL", status: "in_progress", conclusion: null }] },
    [`GET repos/${R}/commits/abc/status`]: { statuses: [{ context: "ci/x", state: "success" }] },
  });
  const out = JSON.parse(gh(["pr", "list", "--repo", R, "--state", "open", "--json", "number,statusCheckRollup"]));
  assert.deepEqual(out[0].statusCheckRollup, [
    { __typename: "CheckRun", name: "test (ubuntu-latest, 22.x)", status: "COMPLETED", conclusion: "SUCCESS" },
    { __typename: "CheckRun", name: "CodeQL", status: "IN_PROGRESS", conclusion: "" },
    { __typename: "StatusContext", context: "ci/x", state: "SUCCESS" },
  ]);
});

test("pr view: files は path/additions/deletions、state は MERGED、mergeCommit は oid", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls/10`]: pr(),
    [`GET repos/${R}/pulls/10/files?per_page=100&page=1`]: [{ filename: "README.md", additions: 3, deletions: 1 }],
  });
  const v = JSON.parse(gh(["pr", "view", "10", "--repo", R, "--json", "state,files,mergeCommit,headRefName"]));
  assert.equal(v.state, "MERGED");
  assert.deepEqual(v.files, [{ path: "README.md", additions: 3, deletions: 1 }]);
  assert.deepEqual(v.mergeCommit, { oid: "deadbeef" });
  assert.equal(gh(["pr", "view", "10", "--repo", R, "--json", "state", "--jq", ".state"]), "MERGED");
});

test("pr create: 作成後にラベルを付け、URLを返す", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/pulls`]: pr({ number: 30, html_url: "https://github.com/o/r/pull/30" }), [`POST repos/${R}/issues/30/labels`]: [] });
  const url = gh(["pr", "create", "--repo", R, "--base", "main", "--head", "agent/issue-1", "--title", "t", "--body", "b", "--label", "agent-authored"]);
  assert.equal(url, "https://github.com/o/r/pull/30");
  assert.deepEqual(calls[0].body, { title: "t", body: "b", head: "agent/issue-1", base: "main" });
  assert.deepEqual(calls[1].body, { labels: ["agent-authored"] });
});

test("pr merge --auto: GraphQL専用のため何もしない（Actionsのworkflowが担う）。--auto なしは直接マージ", () => {
  const { gh, calls } = fake({ [`PUT repos/${R}/pulls/5/merge`]: {} });
  assert.equal(gh(["pr", "merge", "https://github.com/o/r/pull/5", "--repo", R, "--auto", "--squash"]), "");
  assert.equal(calls.length, 0);
  gh(["pr", "merge", "5", "--repo", R, "--squash"]);
  assert.deepEqual(calls[0].body, { merge_method: "squash" });
});

test("pr diff: diff形式で取得し、そのまま返す", () => {
  const { gh, calls } = fake({ [`GET repos/${R}/pulls/8`]: "diff --git a/x b/x\n" });
  assert.equal(gh(["pr", "diff", "8", "--repo", R]), "diff --git a/x b/x\n");
  assert.equal(calls[0].opts.accept, "application/vnd.github.v3.diff");
  assert.equal(calls[0].opts.raw, true);
});

test("run list: ワークフロー・ブランチ・イベントで絞り、gh と同じ項目名で返す", () => {
  const { gh } = fake({
    [`GET repos/${R}/actions/workflows/test.yml/runs?branch=main&event=push&per_page=100&page=1`]: { workflow_runs: [{ id: 99, name: "Test", status: "completed", conclusion: "failure", head_sha: "abc", head_branch: "main", event: "push", run_attempt: 2, display_title: "t" }] },
  });
  const out = JSON.parse(gh(["run", "list", "--repo", R, "--workflow", "test.yml", "--branch", "main", "--event", "push", "--limit", "1", "--json", "databaseId,status,conclusion,headSha,attempt"]));
  assert.deepEqual(out, [{ databaseId: 99, status: "completed", conclusion: "failure", headSha: "abc", attempt: 2 }]);
});

test("run view --log-failed: 失敗したジョブのログを集める。run rerun --failed は失敗ジョブの再実行", () => {
  const { gh, calls } = fake({
    [`GET repos/${R}/actions/runs/99/jobs?filter=latest&per_page=100`]: { jobs: [{ id: 1, name: "test (ubuntu)", conclusion: "failure" }, { id: 2, name: "ok", conclusion: "success" }] },
    [`GET repos/${R}/actions/jobs/1/logs`]: "エラーの行\n",
    [`POST repos/${R}/actions/runs/99/rerun-failed-jobs`]: null,
  });
  const log = gh(["run", "view", "99", "--repo", R, "--log-failed"]);
  assert.match(log, /### test \(ubuntu\)/);
  assert.match(log, /エラーの行/);
  assert.doesNotMatch(log, /### ok/);
  gh(["run", "rerun", "99", "--repo", R, "--failed"]);
  assert.equal(calls.at(-1).method, "POST");
});

test("未対応のコマンドは、明示的なエラーにする（黙って成功にしない）", () => {
  const { gh } = fake();
  assert.throws(() => gh(["release", "list"]), /未対応/);
  assert.throws(() => gh(["pr", "checks", "5"]), /未対応|Cannot|undefined/);
});

test("番号でない値（インジェクションの恐れ）はエラーにする", () => {
  const { gh } = fake();
  assert.throws(() => gh(["issue", "view", "5;rm -rf", "--repo", R, "--json", "state"]), /番号/);
});

test("resolveAuth: inherit は、実行環境の認証をそのまま引き継ぐ（トークンを渡さず、環境変数も除外しない）", () => {
  const p = resolveAuth({ AGENT_AUTH: "inherit" }, "none");
  assert.equal(p.error, undefined);
  assert.deepEqual(p.passEnv, []);
  assert.deepEqual(p.stripEnv, []);
  assert.equal(p.inherit, true);
});
