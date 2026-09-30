/**
 * `gh` コマンドの互換層（REST版）。GraphQLが使えない環境（Claude Codeのクラウドセッション）で、
 * agent/ が使う `gh` サブコマンドを、RESTだけで実行する。
 *
 * 呼び出し側は、`run.mjs` の `gh(...args)` に、これまでと同じ引数（`["issue", "list", "--repo", ...]`）を渡す。
 * 環境変数 AGENT_GH_MODE=rest のとき、このモジュールが引数を解釈してREST APIに翻訳し、`gh` と同じ形の
 * 標準出力（`--json` のJSON、作成したものの URL、差分のテキスト）を返す。
 *
 * 対応するサブコマンド（agent/ が使う範囲）:
 *   label create / issue list,view,create,edit,comment,close,reopen / pr list,view,create,edit,comment,merge,diff /
 *   run list,view,rerun / api
 * 対応外（例: `pr merge --auto` はGraphQL専用）は、その旨を返して何もしない（自動マージはActionsのworkflowが担う）。
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 17）
 */
import { execFileSync } from "node:child_process";

/**
 * @typedef {(method: string, path: string, body?: unknown, opts?: {accept?: string, raw?: boolean}) => any} ApiFn
 */

/** 実際に `gh api`（REST）を呼ぶ既定の実装。 */
/** @type {ApiFn} */
export function ghApi(method, path, body, opts = {}) {
  const args = ["api", "-X", method, path];
  if (opts.accept) args.push("-H", `Accept: ${opts.accept}`);
  if (body !== undefined) args.push("--input", "-");
  const out = execFileSync("gh", args, {
    encoding: "utf8",
    input: body === undefined ? undefined : JSON.stringify(body),
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 128 * 1024 * 1024,
  });
  if (opts.raw) return out;
  const t = out.trim();
  return t === "" ? null : JSON.parse(t);
}

/**
 * 引数を解釈する。値を取るオプションは、複数回指定できる（配列にまとめる）。
 * @param {string[]} argv サブコマンドの後ろの引数
 * @param {string[]} valueOpts 値を取るオプション名（`--repo` など）
 * @returns {{positional: string[], opts: Record<string, string[]>, flags: Set<string>}}
 */
export function parseArgs(argv, valueOpts) {
  /** @type {string[]} */
  const positional = [];
  /** @type {Record<string, string[]>} */
  const opts = Object.create(null);
  const flags = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv.at(i);
    if (a.startsWith("--")) {
      if (valueOpts.includes(a)) {
        // a は直前の valueOpts.includes(a) で許可リスト（値を取るオプション名の固定一覧）と
        // 照合済みであり、任意の外部入力がそのままキーになることはない。
        // eslint-disable-next-line security/detect-object-injection
        (opts[a] ??= []).push(String(argv.at(++i) ?? ""));
      } else {
        flags.add(a);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, opts, flags };
}

// k はこのファイル内の呼び出し元がすべてリテラルで渡すCLIオプション名（"--repo" 等）であり、
// 外部入力（Issue本文等）が直接キーになることはない。
// eslint-disable-next-line security/detect-object-injection
const first = (opts, k) => (opts[k] && opts[k].length > 0 ? opts[k][0] : undefined);
const upper = (s) => (typeof s === "string" ? s.toUpperCase() : "");

/** 対象のIssue/PR番号（数字だけ）。URLが渡された場合は、末尾の番号を使う。 */
function numberOf(token) {
  const s = String(token ?? "");
  const tail = s.includes("/") ? s.slice(s.lastIndexOf("/") + 1) : s;
  if (!(tail.length > 0 && [...tail].every((c) => c >= "0" && c <= "9"))) throw new Error(`番号を解釈できません: ${token}`);
  return Number(tail);
}

/** 単純な jq（`.a` `.a.b` のみ）。agent/ が使う範囲。 */
function simpleJq(value, expr) {
  if (!expr.startsWith(".")) throw new Error(`未対応のjq式: ${expr}`);
  let v = value;
  // key は `--jq` に渡された式（agent/ 内部の呼び出し元がすべてリテラルで指定する）の
  // ドット区切りのフィールド名であり、外部入力が直接キーになることはない。
  for (const key of expr.slice(1).split(".").filter(Boolean)) v = v?.[key]; // eslint-disable-line security/detect-object-injection
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** `--json a,b` に従って、必要なフィールドだけを残す。 */
function project(obj, jsonOpt) {
  if (!jsonOpt) return obj;
  const keys = jsonOpt.split(",").map((s) => s.trim()).filter(Boolean);
  return Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));
}

/** 出力を `--json` / `--jq` の指定どおりに整形する。 */
function emit(value, opts) {
  const jq = first(opts, "--jq");
  if (jq) return simpleJq(value, jq);
  return JSON.stringify(value);
}

/**
 * REST互換の `gh` を作る。
 * @param {{api?: ApiFn, repo?: string}} [config]
 * @returns {(argv: string[]) => string} `gh(...args)` と同じ形（引数の配列 → 標準出力の文字列）
 */
export function createGhRest({ api = ghApi, repo: defaultRepo = "" } = {}) {
  /** ページを辿って、上限件数まで集める。 */
  function paged(path, limit, mapPage = (x) => x) {
    const out = [];
    for (let page = 1; out.length < limit; page++) {
      const sep = path.includes("?") ? "&" : "?";
      const items = mapPage(api("GET", `${path}${sep}per_page=100&page=${page}`));
      if (!Array.isArray(items) || items.length === 0) break;
      out.push(...items);
      if (items.length < 100) break;
    }
    return out.slice(0, limit);
  }

  const labelsOf = (x) => (x.labels ?? []).map((l) => ({ name: typeof l === "string" ? l : l.name }));

  function issueObj(i) {
    return {
      number: i.number,
      title: i.title,
      body: i.body ?? "",
      state: upper(i.state),
      stateReason: i.state_reason ?? null,
      author: { login: i.user?.login ?? "" },
      labels: labelsOf(i),
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      closedAt: i.closed_at ?? null,
      url: i.html_url,
    };
  }

  /** PRの必須チェックの状態（gh の statusCheckRollup と同じ形）。 */
  function rollup(R, sha) {
    const runs = paged(`repos/${R}/commits/${sha}/check-runs`, 200, (r) => r?.check_runs ?? []).map((c) => ({
      __typename: "CheckRun",
      name: c.name,
      status: upper(c.status),
      conclusion: upper(c.conclusion ?? ""),
    }));
    const combined = api("GET", `repos/${R}/commits/${sha}/status`);
    const statuses = (combined?.statuses ?? []).map((s) => ({ __typename: "StatusContext", context: s.context, state: upper(s.state) }));
    return [...runs, ...statuses];
  }

  function prObj(R, p, want) {
    /** @type {Record<string, any>} */
    let d = p;
    // 一覧の応答に無い項目（merged_by 等）が要る場合だけ、個別に取得する
    if (want.has("mergedBy") && p.merged_at && p.merged_by === undefined) d = api("GET", `repos/${R}/pulls/${p.number}`);
    const obj = {
      number: d.number,
      title: d.title,
      body: d.body ?? "",
      state: d.merged_at ? "MERGED" : upper(d.state),
      headRefName: d.head?.ref,
      headRefOid: d.head?.sha,
      baseRefName: d.base?.ref,
      isDraft: Boolean(d.draft),
      labels: labelsOf(d),
      author: { login: d.user?.login ?? "" },
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      mergedAt: d.merged_at ?? null,
      mergedBy: d.merged_by ? { login: d.merged_by.login, is_bot: d.merged_by.type === "Bot" } : null,
      mergeCommit: d.merge_commit_sha ? { oid: d.merge_commit_sha } : null,
      autoMergeRequest: d.auto_merge ?? null,
      url: d.html_url,
    };
    if (want.has("statusCheckRollup")) obj.statusCheckRollup = rollup(R, d.head?.sha);
    if (want.has("files")) obj.files = paged(`repos/${R}/pulls/${d.number}/files`, 300).map((f) => ({ path: f.filename, additions: f.additions, deletions: f.deletions }));
    if (want.has("comments")) obj.comments = paged(`repos/${R}/issues/${d.number}/comments`, 300).map((c) => ({ body: c.body, author: { login: c.user?.login ?? "" }, createdAt: c.created_at }));
    return obj;
  }

  const wantOf = (opts) => new Set((first(opts, "--json") ?? "").split(",").map((s) => s.trim()).filter(Boolean));

  function labelOps(R, n, opts) {
    const add = opts["--add-label"] ?? [];
    const remove = opts["--remove-label"] ?? [];
    for (const name of remove) {
      try {
        api("DELETE", `repos/${R}/issues/${n}/labels/${encodeURIComponent(name)}`);
      } catch (e) {
        if (!String(e?.stderr ?? e?.message ?? "").includes("404")) throw e; // 付いていないラベルの削除は無視する
      }
    }
    if (add.length > 0) api("POST", `repos/${R}/issues/${n}/labels`, { labels: add });
  }

  const V = {
    labelCreate: ["--repo", "--color", "--description"],
    issueList: ["--repo", "--state", "--label", "--json", "--limit", "--jq"],
    issueView: ["--repo", "--json", "--jq"],
    issueCreate: ["--repo", "--title", "--body", "--label"],
    issueEdit: ["--repo", "--add-label", "--remove-label"],
    issueComment: ["--repo", "--body"],
    issueClose: ["--repo", "--reason", "--comment"],
    prList: ["--repo", "--state", "--label", "--head", "--json", "--limit", "--jq"],
    prView: ["--repo", "--json", "--jq"],
    prCreate: ["--repo", "--base", "--head", "--title", "--body", "--label"],
    prMerge: ["--repo"],
    runList: ["--repo", "--branch", "--workflow", "--event", "--limit", "--json", "--jq"],
    runView: ["--repo"],
  };

  return function ghRest(argv) {
    const [group, sub, ...rest] = argv;
    const envRepo = defaultRepo;
    const repoOf = (opts) => first(opts, "--repo") ?? envRepo;

    if (group === "api") {
      const [path] = argv.slice(1);
      return JSON.stringify(api("GET", path));
    }

    if (group === "label" && sub === "create") {
      const { positional, opts } = parseArgs(rest, V.labelCreate);
      const R = repoOf(opts);
      const body = { name: positional[0], color: first(opts, "--color") ?? "ededed", description: first(opts, "--description") ?? "" };
      try {
        api("POST", `repos/${R}/labels`, body);
      } catch (e) {
        // 既に存在する場合（--force）は、更新する
        if (!String(e?.stderr ?? e?.message ?? "").includes("422")) throw e;
        api("PATCH", `repos/${R}/labels/${encodeURIComponent(body.name)}`, { new_name: body.name, color: body.color, description: body.description });
      }
      return "";
    }

    if (group === "issue") {
      const { positional, opts } = parseArgs(rest, V["issue" + sub[0].toUpperCase() + sub.slice(1)] ?? ["--repo"]);
      const R = repoOf(opts);
      if (sub === "list") {
        const state = first(opts, "--state") ?? "open";
        const label = (opts["--label"] ?? []).join(",");
        const limit = Number(first(opts, "--limit") ?? 30);
        const path = `repos/${R}/issues?state=${state}${label ? `&labels=${encodeURIComponent(label)}` : ""}`;
        // /issues にはPRも含まれるため、除く
        const items = paged(path, limit * 3 + 100).filter((i) => !i.pull_request).slice(0, limit).map(issueObj);
        return emit(items.map((i) => project(i, first(opts, "--json"))), opts);
      }
      if (sub === "view") {
        const n = numberOf(positional[0]);
        const i = api("GET", `repos/${R}/issues/${n}`);
        const obj = issueObj(i);
        if (wantOf(opts).has("comments")) obj.comments = paged(`repos/${R}/issues/${n}/comments`, 300).map((c) => ({ body: c.body, author: { login: c.user?.login ?? "" }, createdAt: c.created_at }));
        return emit(project(obj, first(opts, "--json")), opts);
      }
      if (sub === "create") {
        const i = api("POST", `repos/${R}/issues`, { title: first(opts, "--title"), body: first(opts, "--body") ?? "", labels: opts["--label"] ?? [] });
        return i.html_url;
      }
      if (sub === "edit") {
        labelOps(R, numberOf(positional[0]), opts);
        return "";
      }
      if (sub === "comment") {
        api("POST", `repos/${R}/issues/${numberOf(positional[0])}/comments`, { body: first(opts, "--body") ?? "" });
        return "";
      }
      if (sub === "close") {
        const n = numberOf(positional[0]);
        const c = first(opts, "--comment");
        if (c) api("POST", `repos/${R}/issues/${n}/comments`, { body: c });
        const reason = first(opts, "--reason") === "not planned" ? "not_planned" : "completed";
        api("PATCH", `repos/${R}/issues/${n}`, { state: "closed", state_reason: reason });
        return "";
      }
      if (sub === "reopen") {
        api("PATCH", `repos/${R}/issues/${numberOf(positional[0])}`, { state: "open", state_reason: "reopened" });
        return "";
      }
    }

    if (group === "pr") {
      const { positional, opts, flags } = parseArgs(rest, V["pr" + sub[0].toUpperCase() + sub.slice(1)] ?? ["--repo"]);
      const R = repoOf(opts);
      if (sub === "list") {
        const state = first(opts, "--state") ?? "open";
        const label = opts["--label"] ?? [];
        const limit = Number(first(opts, "--limit") ?? 30);
        const head = first(opts, "--head");
        const owner = R.split("/")[0];
        const restState = state === "merged" ? "closed" : state;
        const path = `repos/${R}/pulls?state=${restState}${head ? `&head=${encodeURIComponent(`${owner}:${head}`)}` : ""}`;
        const want = wantOf(opts);
        const items = paged(path, 1000)
          .filter((p) => (state === "merged" ? Boolean(p.merged_at) : true))
          .filter((p) => label.every((l) => labelsOf(p).some((x) => x.name === l)))
          .slice(0, limit)
          .map((p) => project(prObj(R, p, want), first(opts, "--json")));
        return emit(items, opts);
      }
      if (sub === "view") {
        const n = numberOf(positional[0]);
        const p = api("GET", `repos/${R}/pulls/${n}`);
        return emit(project(prObj(R, p, wantOf(opts)), first(opts, "--json")), opts);
      }
      if (sub === "create") {
        const p = api("POST", `repos/${R}/pulls`, { title: first(opts, "--title"), body: first(opts, "--body") ?? "", head: first(opts, "--head"), base: first(opts, "--base") });
        const labels = opts["--label"] ?? [];
        if (labels.length > 0) api("POST", `repos/${R}/issues/${p.number}/labels`, { labels });
        return p.html_url;
      }
      if (sub === "edit") {
        labelOps(R, numberOf(positional[0]), opts);
        return "";
      }
      if (sub === "comment") {
        api("POST", `repos/${R}/issues/${numberOf(positional[0])}/comments`, { body: first(opts, "--body") ?? "" });
        return "";
      }
      if (sub === "diff") {
        return api("GET", `repos/${R}/pulls/${numberOf(positional[0])}`, undefined, { accept: "application/vnd.github.v3.diff", raw: true });
      }
      if (sub === "merge") {
        // 自動マージの予約はGraphQL専用のため、この環境では行わない（Actionsのworkflowが担う）。
        if (flags.has("--auto")) return "";
        api("PUT", `repos/${R}/pulls/${numberOf(positional[0])}/merge`, { merge_method: flags.has("--squash") ? "squash" : "merge" });
        return "";
      }
    }

    if (group === "run") {
      const { positional, opts, flags } = parseArgs(rest, V["run" + sub[0].toUpperCase() + sub.slice(1)] ?? ["--repo"]);
      const R = repoOf(opts);
      if (sub === "list") {
        const q = [];
        if (first(opts, "--branch")) q.push(`branch=${encodeURIComponent(first(opts, "--branch"))}`);
        if (first(opts, "--event")) q.push(`event=${encodeURIComponent(first(opts, "--event"))}`);
        const wf = first(opts, "--workflow");
        const base = wf ? `repos/${R}/actions/workflows/${encodeURIComponent(wf)}/runs` : `repos/${R}/actions/runs`;
        const runs = paged(`${base}${q.length ? `?${q.join("&")}` : ""}`, Number(first(opts, "--limit") ?? 20), (r) => r?.workflow_runs ?? []).map((r) => ({
          databaseId: r.id,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion ?? "",
          headSha: r.head_sha,
          headBranch: r.head_branch,
          event: r.event,
          attempt: r.run_attempt,
          displayTitle: r.display_title,
        }));
        return emit(runs.map((r) => project(r, first(opts, "--json"))), opts);
      }
      if (sub === "view" && flags.has("--log-failed")) {
        const id = numberOf(positional[0]);
        const jobs = api("GET", `repos/${R}/actions/runs/${id}/jobs?filter=latest&per_page=100`)?.jobs ?? [];
        const parts = [];
        for (const j of jobs.filter((x) => x.conclusion === "failure")) {
          /** @type {string} */
          let text;
          try {
            text = api("GET", `repos/${R}/actions/jobs/${j.id}/logs`, undefined, { raw: true });
          } catch {
            text = "(ログを取得できませんでした)";
          }
          parts.push(`### ${j.name}\n${text}`);
        }
        return parts.join("\n");
      }
      if (sub === "rerun") {
        api("POST", `repos/${R}/actions/runs/${numberOf(positional[0])}/rerun-failed-jobs`);
        return "";
      }
    }

    throw new Error(`REST互換の gh が未対応のコマンドです: gh ${argv.slice(0, 2).join(" ")}`);
  };
}
