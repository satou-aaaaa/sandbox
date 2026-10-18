// agent/gh-rest.mjs の分岐（既定値・欠けた項目・ページ送り・エラー経路）を確かめる追加テスト。
// HTTP 層は agent-ghrest.test.js と同じく模擬の REST API に置き換える（実際の gh は呼ばない）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGhRest, parseArgs } from "../agent/gh-rest.mjs";

const R = "o/r";

/**
 * 模擬のREST API。`routes` は「メソッド パス（クエリ含む）→ 応答」。未登録は例外。呼び出しを calls に記録する。
 * @param {Record<string, any>} routes
 * @param {string} [repo] 既定のリポジトリ
 */
function fake(routes = {}, repo = R) {
  /** @type {{method: string, path: string, body: any, opts: any}[]} */
  const calls = [];
  /** @type {import("../agent/gh-rest.mjs").ApiFn} */
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
  return { api, calls, gh: createGhRest({ api, repo }) };
}

const keyOf = (c) => `${c.method} ${c.path}`;

test("parseArgs: 値を取るオプションが末尾で値が無いときは空文字にする", () => {
  const { opts, positional, flags } = parseArgs(["7", "--repo"], ["--repo"]);
  assert.deepEqual(opts["--repo"], [""]);
  assert.deepEqual(positional, ["7"]);
  assert.equal(flags.size, 0);
});

test("createGhRest: 引数なしでも作れる（既定の api は未対応コマンドでは呼ばれない）", () => {
  const gh = createGhRest();
  assert.throws(() => gh(["release", "list"]), /未対応のコマンドです: gh release list/);
});

test("api: GET してJSON文字列で返す", () => {
  const { gh, calls } = fake({ [`GET repos/${R}/pulls/1`]: { number: 1, title: "x" } });
  assert.equal(gh(["api", `repos/${R}/pulls/1`]), JSON.stringify({ number: 1, title: "x" }));
  assert.equal(calls[0].method, "GET");
});

test("--repo 省略時は createGhRest の既定リポジトリを使う", () => {
  const { gh, calls } = fake({ [`GET repos/other/repo/issues/3`]: { number: 3, title: "t", state: "open" } }, "other/repo");
  const v = JSON.parse(gh(["issue", "view", "3", "--json", "number"]));
  assert.deepEqual(v, { number: 3 });
  assert.equal(calls[0].path, "repos/other/repo/issues/3");
});

test("issue view: 欠けた項目は既定値で埋め、文字列ラベルも name に揃える。--json 省略時は全項目", () => {
  const { gh } = fake({
    [`GET repos/${R}/issues/2`]: { number: 2, title: "t", body: null, labels: ["bug", { name: "agent-ready" }], html_url: "u" },
  });
  const v = JSON.parse(gh(["issue", "view", "2", "--repo", R]));
  assert.equal(v.body, "");
  assert.equal(v.state, ""); // state が無ければ空文字
  assert.equal(v.stateReason, null);
  assert.deepEqual(v.author, { login: "" });
  assert.deepEqual(v.labels, [{ name: "bug" }, { name: "agent-ready" }]);
  assert.equal(v.closedAt, null);
  assert.equal(v.url, "u");
  assert.equal(v.comments, undefined); // comments を求めていないので取得しない
});

test("issue view: labels が無くても空配列、state_reason・closed_at はそのまま返す", () => {
  const { gh } = fake({
    [`GET repos/${R}/issues/4`]: { number: 4, title: "t", state: "closed", state_reason: "not_planned", closed_at: "2026-10-01T00:00:00Z" },
  });
  const v = JSON.parse(gh(["issue", "view", "4", "--repo", R, "--json", "labels,stateReason,closedAt,state"]));
  assert.deepEqual(v, { labels: [], stateReason: "not_planned", closedAt: "2026-10-01T00:00:00Z", state: "CLOSED" });
});

test("issue view: URL を渡すと末尾の番号を使う。コメントの投稿者が無ければ空文字", () => {
  const { gh, calls } = fake({
    [`GET repos/${R}/issues/12`]: { number: 12, title: "t", state: "open" },
    [`GET repos/${R}/issues/12/comments?per_page=100&page=1`]: [{ body: "c", created_at: "z" }],
  });
  const v = JSON.parse(gh(["issue", "view", "https://github.com/o/r/issues/12", "--repo", R, "--json", "comments"]));
  assert.deepEqual(v.comments, [{ body: "c", author: { login: "" }, createdAt: "z" }]);
  assert.equal(calls[0].path, `repos/${R}/issues/12`);
});

test("番号の解釈: 番号の省略・末尾が空のURL・空文字はエラーにする（API を呼ばない）", () => {
  const { gh, calls } = fake();
  assert.throws(() => gh(["issue", "view", "--repo", R]), /番号を解釈できません: undefined/);
  assert.throws(() => gh(["issue", "comment", "https://github.com/o/r/issues/", "--repo", R]), /番号/);
  assert.throws(() => gh(["pr", "view", "", "--repo", R]), /番号/);
  assert.equal(calls.length, 0);
});

test("--jq: ネストしたフィールドを辿る。文字列以外はJSON、途中が無ければ undefined", () => {
  const { gh } = fake({ [`GET repos/${R}/issues/5`]: { number: 5, title: "t", state: "open", user: { login: "me" } } });
  assert.equal(gh(["issue", "view", "5", "--repo", R, "--json", "author", "--jq", ".author.login"]), "me");
  assert.equal(gh(["issue", "view", "5", "--repo", R, "--json", "author", "--jq", ".author"]), '{"login":"me"}');
  assert.equal(gh(["issue", "view", "5", "--repo", R, "--json", "number", "--jq", ".number"]), "5");
  assert.equal(gh(["issue", "view", "5", "--repo", R, "--json", "number", "--jq", ".nope.deeper"]), undefined);
});

test("--jq: ドットで始まらない式は未対応としてエラー", () => {
  const { gh } = fake({ [`GET repos/${R}/issues/5`]: { number: 5, title: "t", state: "open" } });
  assert.throws(() => gh(["issue", "view", "5", "--repo", R, "--jq", "length"]), /未対応のjq式: length/);
});

test("issue list: 既定は state=open・ラベルなし・上限30。100件ちょうどのページは次ページも取りに行く", () => {
  const page1 = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, title: "t", state: "open", pull_request: {} }));
  const page2 = Array.from({ length: 40 }, (_, i) => ({ number: 101 + i, title: "t", state: "open" }));
  const { gh, calls } = fake({
    [`GET repos/${R}/issues?state=open&per_page=100&page=1`]: page1,
    [`GET repos/${R}/issues?state=open&per_page=100&page=2`]: page2,
  });
  const out = JSON.parse(gh(["issue", "list", "--repo", R, "--json", "number"]));
  // 1ページ目は全部PRなので除かれ、2ページ目から既定の30件だけ
  assert.equal(out.length, 30);
  assert.equal(out[0].number, 101);
  assert.deepEqual(calls.map(keyOf), [`GET repos/${R}/issues?state=open&per_page=100&page=1`, `GET repos/${R}/issues?state=open&per_page=100&page=2`]);
});

test("issue list: 応答が配列でない・空ならページ送りを止める", () => {
  const { gh } = fake({ [`GET repos/${R}/issues?state=closed&per_page=100&page=1`]: { message: "oops" } });
  assert.equal(gh(["issue", "list", "--repo", R, "--state", "closed", "--json", "number"]), "[]");
  const empty = fake({ [`GET repos/${R}/issues?state=open&per_page=100&page=1`]: [] });
  assert.equal(empty.gh(["issue", "list", "--repo", R]), "[]");
});

test("issue list: --limit が多いと上限件数に達したところでページ送りを止める", () => {
  const full = (start) => Array.from({ length: 100 }, (_, i) => ({ number: start + i, title: "t", state: "open" }));
  const { gh, calls } = fake({
    [`GET repos/${R}/issues?state=open&per_page=100&page=1`]: full(1),
    [`GET repos/${R}/issues?state=open&per_page=100&page=2`]: full(101),
  });
  // limit=0 → 上限 0*3+100=100件で止まり、結果は0件
  assert.equal(gh(["issue", "list", "--repo", R, "--limit", "0", "--json", "number"]), "[]");
  assert.equal(calls.length, 1);
});

test("issue create: 本文とラベルを省略すると空で作る", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/issues`]: { html_url: "https://github.com/o/r/issues/9" } });
  assert.equal(gh(["issue", "create", "--repo", R, "--title", "題"]), "https://github.com/o/r/issues/9");
  assert.deepEqual(calls[0].body, { title: "題", body: "", labels: [] });
});

test("issue comment: 本文を投稿する（--body 省略時は空文字）", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/issues/6/comments`]: {} });
  assert.equal(gh(["issue", "comment", "6", "--repo", R, "--body", "了解"]), "");
  assert.deepEqual(calls[0].body, { body: "了解" });
  gh(["issue", "comment", "6", "--repo", R]);
  assert.deepEqual(calls[1].body, { body: "" });
});

test("issue close: コメント・理由の省略時は、コメントせず completed で閉じる", () => {
  const { gh, calls } = fake({ [`PATCH repos/${R}/issues/4`]: {} });
  gh(["issue", "close", "4", "--repo", R]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { state: "closed", state_reason: "completed" });
});

test("issue edit: ラベル指定が無ければ何も呼ばない。message だけの404も無視する", () => {
  const { gh, calls } = fake({ [`DELETE repos/${R}/issues/3/labels/a%20b`]: new Error("HTTP 404: Not Found") });
  gh(["issue", "edit", "3", "--repo", R]);
  assert.equal(calls.length, 0);
  gh(["issue", "edit", "3", "--repo", R, "--remove-label", "a b"]);
  assert.deepEqual(calls.map(keyOf), [`DELETE repos/${R}/issues/3/labels/a%20b`]);
});

test("issue edit: stderr も message も無い例外は握りつぶさない", () => {
  const { gh } = fake({ [`DELETE repos/${R}/issues/3/labels/a`]: () => { throw null; } });
  assert.throws(() => gh(["issue", "edit", "3", "--repo", R, "--remove-label", "a"]), (e) => e === null);
});

test("issue の未対応サブコマンドは明示的なエラー", () => {
  const { gh } = fake();
  assert.throws(() => gh(["issue", "pin", "3", "--repo", R]), /未対応のコマンドです: gh issue pin/);
});

test("label create: 色・説明の既定値で作る。422以外のエラーはそのまま投げる", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/labels`]: {} });
  assert.equal(gh(["label", "create", "x", "--repo", R]), "");
  assert.deepEqual(calls[0].body, { name: "x", color: "ededed", description: "" });

  const boom = fake({ [`POST repos/${R}/labels`]: Object.assign(new Error("HTTP 403: forbidden"), { stderr: undefined }) });
  assert.throws(() => boom.gh(["label", "create", "x", "--repo", R]), /403/);
  assert.equal(boom.calls.length, 1); // PATCH はしない
});

test("label create: message に422が含まれる場合も更新に切り替える", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/labels`]: new Error("HTTP 422"), [`PATCH repos/${R}/labels/x`]: {} });
  gh(["label", "create", "x", "--repo", R]);
  assert.deepEqual(calls[1].body, { new_name: "x", color: "ededed", description: "" });
});

const pr = (over = {}) => ({ number: 10, title: "t", state: "open", merged_at: null, head: { ref: "feat", sha: "abc" }, base: { ref: "main" }, html_url: "https://github.com/o/r/pull/10", ...over });

test("pr view: 欠けた項目の既定値（body・author・labels・head/base）、draft・auto_merge・mergedBy なし", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls/10`]: pr({ body: null, head: undefined, base: undefined, draft: true, auto_merge: { merge_method: "squash" }, merged_by: null, merge_commit_sha: null }),
  });
  const v = JSON.parse(gh(["pr", "view", "10", "--repo", R]));
  assert.equal(v.body, "");
  assert.equal(v.state, "OPEN");
  assert.equal(v.headRefName, undefined);
  assert.equal(v.baseRefName, undefined);
  assert.equal(v.isDraft, true);
  assert.deepEqual(v.labels, []);
  assert.deepEqual(v.author, { login: "" });
  assert.equal(v.mergedAt, null);
  assert.equal(v.mergedBy, null);
  assert.equal(v.mergeCommit, null);
  assert.deepEqual(v.autoMergeRequest, { merge_method: "squash" });
});

test("pr view --json mergedBy: 応答に merged_by があれば再取得しない（人の場合 is_bot=false）", () => {
  const { gh, calls } = fake({
    [`GET repos/${R}/pulls/10`]: pr({ merged_at: "2026-10-01T00:00:00Z", merged_by: { login: "satou-aaaaa", type: "User" } }),
  });
  const v = JSON.parse(gh(["pr", "view", "10", "--repo", R, "--json", "mergedBy,state"]));
  assert.deepEqual(v, { mergedBy: { login: "satou-aaaaa", is_bot: false }, state: "MERGED" });
  assert.equal(calls.length, 1);
});

test("pr view --json comments: Issue側のコメントを取得し、投稿者が無ければ空文字", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls/10`]: pr(),
    [`GET repos/${R}/issues/10/comments?per_page=100&page=1`]: [{ body: "LGTM", user: { login: "a" }, created_at: "t1" }, { body: "x", created_at: "t2" }],
  });
  const v = JSON.parse(gh(["pr", "view", "10", "--repo", R, "--json", "comments"]));
  assert.deepEqual(v.comments, [
    { body: "LGTM", author: { login: "a" }, createdAt: "t1" },
    { body: "x", author: { login: "" }, createdAt: "t2" },
  ]);
});

test("pr view --json statusCheckRollup: check-runs・status の応答が欠けても空配列になる", () => {
  const { gh } = fake({
    [`GET repos/${R}/pulls/10`]: pr(),
    [`GET repos/${R}/commits/abc/check-runs?per_page=100&page=1`]: null,
    [`GET repos/${R}/commits/abc/status`]: null,
  });
  assert.deepEqual(JSON.parse(gh(["pr", "view", "10", "--repo", R, "--json", "statusCheckRollup"])), { statusCheckRollup: [] });

  const noStatuses = fake({
    [`GET repos/${R}/pulls/10`]: pr(),
    [`GET repos/${R}/commits/abc/check-runs?per_page=100&page=1`]: {},
    [`GET repos/${R}/commits/abc/status`]: {},
  });
  assert.deepEqual(JSON.parse(noStatuses.gh(["pr", "view", "10", "--repo", R, "--json", "statusCheckRollup"])).statusCheckRollup, []);
});

test("pr list: 既定は state=open・head なし。ラベル指定なしなら全件、--json なしは全項目", () => {
  const { gh, calls } = fake({
    [`GET repos/${R}/pulls?state=open&per_page=100&page=1`]: [pr({ number: 1, labels: ["x"] }), pr({ number: 2 })],
  });
  const out = JSON.parse(gh(["pr", "list", "--repo", R]));
  assert.deepEqual(out.map((p) => p.number), [1, 2]);
  assert.deepEqual(out[0].labels, [{ name: "x" }]);
  assert.ok("headRefName" in out[0] && "url" in out[0]);
  assert.equal(calls[0].path, `repos/${R}/pulls?state=open&per_page=100&page=1`);
});

test("pr list --json mergedBy: マージされていないPRは個別取得しない", () => {
  const { gh, calls } = fake({ [`GET repos/${R}/pulls?state=open&per_page=100&page=1`]: [pr({ number: 3 })] });
  const out = JSON.parse(gh(["pr", "list", "--repo", R, "--json", "number,mergedBy", "--limit", "5"]));
  assert.deepEqual(out, [{ number: 3, mergedBy: null }]);
  assert.equal(calls.length, 1);
});

test("pr create: ラベル・本文の省略時はラベルを付けに行かない", () => {
  const { gh, calls } = fake({ [`POST repos/${R}/pulls`]: pr({ number: 31, html_url: "https://github.com/o/r/pull/31" }) });
  assert.equal(gh(["pr", "create", "--repo", R, "--head", "feat", "--base", "main", "--title", "t"]), "https://github.com/o/r/pull/31");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.body, "");
});

test("pr merge: --squash が無ければ通常のマージ", () => {
  const { gh, calls } = fake({ [`PUT repos/${R}/pulls/5/merge`]: {} });
  gh(["pr", "merge", "5", "--repo", R]);
  assert.deepEqual(calls[0].body, { merge_method: "merge" });
});

test("pr の未対応サブコマンドは明示的なエラー（API を呼ばない）", () => {
  const { gh, calls } = fake();
  assert.throws(() => gh(["pr", "close", "5", "--repo", R]), /未対応のコマンドです: gh pr close/);
  assert.equal(calls.length, 0);
});

test("run list: 絞り込みなしは actions/runs を既定の20件まで。欠けた conclusion は空文字", () => {
  const { gh, calls } = fake({
    [`GET repos/${R}/actions/runs?per_page=100&page=1`]: { workflow_runs: [{ id: 1, name: "CI", status: "in_progress", conclusion: null }] },
  });
  const out = JSON.parse(gh(["run", "list", "--repo", R]));
  assert.equal(out.length, 1);
  assert.equal(out[0].databaseId, 1);
  assert.equal(out[0].conclusion, "");
  assert.equal(calls[0].path, `repos/${R}/actions/runs?per_page=100&page=1`);
});

test("run list: 応答に workflow_runs が無ければ空。--jq で値を取り出せる", () => {
  const { gh } = fake({ [`GET repos/${R}/actions/runs?branch=feat%2Fx&per_page=100&page=1`]: null });
  assert.equal(gh(["run", "list", "--repo", R, "--branch", "feat/x", "--json", "databaseId"]), "[]");
  const one = fake({ [`GET repos/${R}/actions/runs?event=pull_request&per_page=100&page=1`]: { workflow_runs: [{ id: 7, status: "completed", conclusion: "success" }] } });
  assert.equal(one.gh(["run", "list", "--repo", R, "--event", "pull_request", "--json", "databaseId", "--jq", ".0.databaseId"]), "7");
});

test("run view --log-failed: ログが取れないジョブは代わりの文言。jobs が無ければ空文字", () => {
  const { gh } = fake({
    [`GET repos/${R}/actions/runs/5/jobs?filter=latest&per_page=100`]: { jobs: [{ id: 1, name: "a", conclusion: "failure" }, { id: 2, name: "b", conclusion: "failure" }] },
    [`GET repos/${R}/actions/jobs/1/logs`]: new Error("HTTP 410: gone"),
    [`GET repos/${R}/actions/jobs/2/logs`]: "b のログ",
  });
  assert.equal(gh(["run", "view", "5", "--repo", R, "--log-failed"]), "### a\n(ログを取得できませんでした)\n### b\nb のログ");

  const none = fake({ [`GET repos/${R}/actions/runs/6/jobs?filter=latest&per_page=100`]: null });
  assert.equal(none.gh(["run", "view", "6", "--repo", R, "--log-failed"]), "");
});

test("run view: --log-failed なしは未対応のエラー。run の未知サブコマンドも同様", () => {
  const { gh, calls } = fake();
  assert.throws(() => gh(["run", "view", "5", "--repo", R]), /未対応のコマンドです: gh run view/);
  assert.throws(() => gh(["run", "cancel", "5", "--repo", R]), /未対応のコマンドです: gh run cancel/);
  assert.equal(calls.length, 0);
});
