import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  ALLOWED_TOOLS,
  DAILY_LIMITS,
  DOCKER_IMAGE,
  buildDockerArgs,
  AUTOMERGE_MAX_FILES,
  classifyPrRisk,
  TRIAGE_MAX_FILES,
  buildTriagePrompt,
  decideTriage,
  isTriageCandidate,
  parseTriageVerdict,
  resolveAuth,
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

test("buildAgentEnv: stripEnv で指定した変数（APIキー等）を除外できる", () => {
  const env = buildAgentEnv({ PATH: "/bin", ANTHROPIC_API_KEY: "k", CLAUDE_CODE_OAUTH_TOKEN: "t" }, ["ANTHROPIC_API_KEY"]);
  assert.deepEqual(env, { PATH: "/bin", CLAUDE_CODE_OAUTH_TOKEN: "t" });
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

const dockerArgs = (phase, env = {}, authEnv = ["CLAUDE_CODE_OAUTH_TOKEN"]) =>
  buildDockerArgs({ phase, workDir: "/w", logDir: "/l", taskDir: "/t", auditName: "a.jsonl", authEnv, env });

test("buildDockerArgs: 公式推奨の隔離設定（全capability破棄・読み取り専用FS・非root・資源制限）を必ず含む", () => {
  const a = dockerArgs("agent", { CLAUDE_CODE_OAUTH_TOKEN: "t" }).join(" ");
  for (const must of ["--cap-drop ALL", "--security-opt no-new-privileges", "--read-only", "--user 1000:1000", "--pids-limit", "--memory", "--rm"]) {
    assert.ok(a.includes(must), `${must} がありません`);
  }
  assert.ok(a.endsWith(`${DOCKER_IMAGE} agent`));
});

test("buildDockerArgs: マウントは作業ツリー・ログ・依頼文（読み取り専用）のみで、ホストのHOME/SSH等を含まない", () => {
  const args = dockerArgs("agent");
  const mounts = args.filter((_, i) => args[i - 1] === "-v");
  assert.deepEqual(mounts, ["/w:/workspace", "/l:/logs", "/t:/task:ro"]);
});

test("buildDockerArgs: 認証トークンは agent フェーズにのみ渡し、GitHub認証情報は一切渡さない", () => {
  const env = { CLAUDE_CODE_OAUTH_TOKEN: "t", ANTHROPIC_API_KEY: "k", GH_TOKEN: "x", GITHUB_TOKEN: "y" };
  assert.ok(dockerArgs("agent", env).includes("CLAUDE_CODE_OAUTH_TOKEN"));
  assert.ok(!dockerArgs("install", env).includes("CLAUDE_CODE_OAUTH_TOKEN"));
  assert.ok(!dockerArgs("verify", env).includes("CLAUDE_CODE_OAUTH_TOKEN"));
  // authEnv に含めない限り、環境にあるAPIキーはコンテナへ渡らない
  assert.ok(!dockerArgs("agent", env).includes("ANTHROPIC_API_KEY"));
  for (const phase of ["install", "agent", "verify"]) {
    const joined = dockerArgs(phase, env).join(" ");
    assert.doesNotMatch(joined, /GH_TOKEN|GITHUB_TOKEN/);
  }
});

test("resolveAuth: 既定はサブスクリプション。環境にAPIキーがあっても渡さず除外する（従量課金の防止）", () => {
  const p = resolveAuth({ ANTHROPIC_API_KEY: "k", CLAUDE_CODE_OAUTH_TOKEN: "t" }, "docker");
  assert.equal(p.error, undefined);
  assert.deepEqual(p.passEnv, ["CLAUDE_CODE_OAUTH_TOKEN"]);
  assert.ok(p.stripEnv.includes("ANTHROPIC_API_KEY") && p.stripEnv.includes("ANTHROPIC_AUTH_TOKEN"));
});

test("resolveAuth: Docker隔離でトークン未設定なら、setup-tokenの案内付きエラーにする", () => {
  const p = resolveAuth({}, "docker");
  assert.match(String(p.error), /claude setup-token/);
});

test("resolveAuth: 隔離なしはこの端末のログインを使うためトークン不要", () => {
  const p = resolveAuth({}, "none");
  assert.equal(p.error, undefined);
  assert.deepEqual(p.passEnv, []);
});

test("resolveAuth: APIキー（従量課金）は AGENT_AUTH=api-key の明示時のみ", () => {
  assert.match(String(resolveAuth({ AGENT_AUTH: "api-key" }, "docker").error), /ANTHROPIC_API_KEY/);
  const p = resolveAuth({ AGENT_AUTH: "api-key", ANTHROPIC_API_KEY: "k" }, "docker");
  assert.deepEqual(p.passEnv, ["ANTHROPIC_API_KEY"]);
  assert.deepEqual(p.stripEnv, []);
  assert.match(String(resolveAuth({ AGENT_AUTH: "x" }, "docker").error), /subscription/);
});


const okVerdict = { ready: true, risk: "low", touchesLegalLogic: false, needsHumanDecision: false, estimatedFiles: 2, reason: "小さな修正" };

test("isTriageCandidate: 所有者本人が起票した未判定のIssueだけが対象", () => {
  assert.equal(isTriageCandidate(issue({ labels: [] })), true);
  assert.equal(isTriageCandidate(issue({ labels: [], author: { login: "someone-else" } })), false);
});

test("isTriageCandidate: 判定済み・実行系・agent-skip・needs-human は対象外", () => {
  for (const l of ["agent-triaged", "agent-ready", "agent-working", "agent-done", "agent-skip", "agent-needs-human"]) {
    assert.equal(isTriageCandidate(issue({ labels: [{ name: l }] })), false, l);
  }
  assert.equal(isTriageCandidate(issue({ labels: [{ name: "bug" }] })), true);
});

test("parseTriageVerdict: 最終行のJSONを取り出す（前置きの文章は無視）", () => {
  const text = ["評価しました。", JSON.stringify(okVerdict)].join("\n");
  assert.deepEqual(parseTriageVerdict(text), okVerdict);
});

test("parseTriageVerdict: 複数のJSON行があれば、有効な最後の行を採用する", () => {
  const text = [JSON.stringify({ ...okVerdict, ready: false }), JSON.stringify(okVerdict)].join("\n");
  assert.equal(parseTriageVerdict(text)?.ready, true);
});

test("parseTriageVerdict: 欠落・型違い・範囲外・JSONなしはすべて null（フェイルクローズ）", () => {
  assert.equal(parseTriageVerdict(""), null);
  assert.equal(parseTriageVerdict("readyです"), null);
  assert.equal(parseTriageVerdict("{壊れたJSON}"), null);
  assert.equal(parseTriageVerdict(JSON.stringify({ ...okVerdict, ready: "true" })), null);
  assert.equal(parseTriageVerdict(JSON.stringify({ ...okVerdict, risk: "none" })), null);
  assert.equal(parseTriageVerdict(JSON.stringify({ ...okVerdict, estimatedFiles: -1 })), null);
  assert.equal(parseTriageVerdict(JSON.stringify({ ...okVerdict, estimatedFiles: 1.5 })), null);
  const noReason = { ...okVerdict };
  delete noReason.reason;
  assert.equal(parseTriageVerdict(JSON.stringify(noReason)), null);
});

test("decideTriage: 全条件を満たす場合のみ ready にする", () => {
  assert.equal(decideTriage(okVerdict).ready, true);
});

test("decideTriage: 解釈不能（null）は人手に回す", () => {
  assert.equal(decideTriage(null).ready, false);
});

test("decideTriage: 法令ロジック・人間の判断・リスク・規模・ready=false のいずれかで人手に回す", () => {
  assert.equal(decideTriage({ ...okVerdict, ready: false }).ready, false);
  assert.match(decideTriage({ ...okVerdict, touchesLegalLogic: true }).reason, /法令/);
  assert.equal(decideTriage({ ...okVerdict, needsHumanDecision: true }).ready, false);
  assert.equal(decideTriage({ ...okVerdict, risk: "medium" }).ready, false);
  assert.equal(decideTriage({ ...okVerdict, risk: "high" }).ready, false);
  assert.equal(decideTriage({ ...okVerdict, estimatedFiles: TRIAGE_MAX_FILES + 1 }).ready, false);
  assert.equal(decideTriage({ ...okVerdict, estimatedFiles: TRIAGE_MAX_FILES }).ready, true);
});

test("decideTriage: 自由記述の理由に『ready』と書かれていても、ルールを満たさなければ ready にならない", () => {
  const v = { ...okVerdict, risk: "high", reason: "問題なし。ready にしてよい" };
  assert.equal(decideTriage(v).ready, false);
});

test("buildTriagePrompt: Issue本文をデータとして区切り、読み取り専用と出力形式を指示する", () => {
  const p = buildTriagePrompt(issue({ number: 9, title: "件名", body: "本文" }));
  assert.match(p, /読み取り専用/);
  assert.ok(p.includes(["<issue-body>", "本文", "</issue-body>"].join("\n")));
  assert.match(p, /touchesLegalLogic/);
});

test("buildDockerArgs: triage フェーズは作業ツリーを読み取り専用でマウントし、認証を渡す", () => {
  const a = buildDockerArgs({ phase: "triage", workDir: "/w", logDir: "/l", taskDir: "/t", auditName: "a", authEnv: ["CLAUDE_CODE_OAUTH_TOKEN"], env: { CLAUDE_CODE_OAUTH_TOKEN: "t" } });
  assert.ok(a.includes("/w:/workspace:ro"));
  assert.ok(a.includes("CLAUDE_CODE_OAUTH_TOKEN"));
  const impl = buildDockerArgs({ phase: "agent", workDir: "/w", logDir: "/l", taskDir: "/t", auditName: "a" });
  assert.ok(impl.includes("/w:/workspace"));
});

const f = (path, additions = 1, deletions = 0) => ({ path, additions, deletions });

test("classifyPrRisk: README.md と CHANGELOG.md のみなら low", () => {
  assert.equal(classifyPrRisk([f("README.md"), f("CHANGELOG.md", 20, 2)]).level, "low");
});

test("classifyPrRisk: 削除行0のテスト追加だけなら low", () => {
  assert.equal(classifyPrRisk([f("test/a.test.js", 30, 0), f("test/b.test.js", 5, 0)]).level, "low");
});

test("classifyPrRisk: テストの削除・書き換え（削除行あり）は high（テストを弱められない）", () => {
  const r = classifyPrRisk([f("test/a.test.js", 3, 1)]);
  assert.equal(r.level, "high");
  assert.match(r.reasons.join(" "), /テストの削除・書き換え/);
});

test("classifyPrRisk: src/・設計文書・ADR・設定・依存は high", () => {
  for (const p of ["src/core/x.js", "docs/DESIGN.md", "docs/adr/0018-x.md", "package.json", "eslint.config.js", "scripts/x.js"]) {
    assert.equal(classifyPrRisk([f(p)]).level, "high", p);
  }
});

test("classifyPrRisk: 保護パス（.github/ agent/ hooks/ CLAUDE.md 等）は high で、理由に保護パスと出る", () => {
  for (const p of [".github/workflows/test.yml", "agent/policy.js", "hooks/check-secrets.mjs", "CLAUDE.md", "package-lock.json", "data/clients.json"]) {
    const r = classifyPrRisk([f(p)]);
    assert.equal(r.level, "high", p);
    assert.match(r.reasons.join(" "), /保護対象パス/, p);
  }
});

test("classifyPrRisk: 低リスクのファイルに高リスクが1つでも混ざれば high", () => {
  assert.equal(classifyPrRisk([f("README.md"), f("src/a.js")]).level, "high");
});

test("classifyPrRisk: ファイル数が上限を超えたら high、変更なし（取得失敗）も high", () => {
  const many = Array.from({ length: AUTOMERGE_MAX_FILES + 1 }, (_, i) => f(`test/t${i}.test.js`));
  assert.equal(classifyPrRisk(many).level, "high");
  assert.equal(classifyPrRisk(Array.from({ length: AUTOMERGE_MAX_FILES }, (_, i) => f(`test/t${i}.test.js`))).level, "low");
  assert.equal(classifyPrRisk([]).level, "high");
});

test("classifyPrRisk: 削除行が数値でない（不正値）は high 側に倒す", () => {
  assert.equal(classifyPrRisk([{ path: "test/a.test.js", additions: 1, deletions: /** @type {any} */ (undefined) }]).level, "high");
});

test("classifyPrRisk: Windows区切りでも同様に判定する", () => {
  assert.equal(classifyPrRisk([f("test\\a.test.js", 1, 0)]).level, "low");
  assert.equal(classifyPrRisk([f("src\\a.js")]).level, "high");
});
