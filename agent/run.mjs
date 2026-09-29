#!/usr/bin/env node
/**
 * GitHub Issue 自律処理ループ（オーケストレーター）。
 *
 * `agent-ready` ラベル付きのIssue（起票者が所有者本人のものだけ）を1件ずつ
 * 取り出し、隔離した git worktree でClaude Agent SDKに実装させ、
 * 検証（test/typecheck/lint/check-secrets）に通った場合のみ、ブランチをpushして
 * PRを作る。【マージは行わない】。最終判断は常に人間が行う。
 *
 * 権限の分離:
 *   - エージェント: 作業ツリー内のファイル編集とテスト実行のみ（policy.js）
 *   - このスクリプト: commit / push / PR作成（決定的なコード。LLMは介在しない）
 *
 * 多層防御（docs/adr/0017-agent-sdk-issue-loop.md）:
 *   1. 許可リスト（dontAsk）＋拒否リスト  2. PreToolUseフックによる最終判定と監査ログ
 *   3. 保護パス検査  4. 検証ゲート  5. 日次上限・1件あたりの上限・壁時計上限
 *   6. キルスイッチ（agent/.disabled または AGENT_DISABLED=1）
 *
 * 使い方:
 *   node run.mjs --dry-run           対象Issueとエージェント設定を表示（API呼び出しなし）
 *   node run.mjs                     agent-ready のIssueを最大 --max 件処理
 *   node run.mjs --issue 81          指定Issueのみ処理（ラベル条件は同じく必須）
 *
 * 前提: `gh` にログイン済み、環境変数 ANTHROPIC_API_KEY が設定済み。
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
  LABEL_DONE,
  LABEL_PR,
  LABEL_READY,
  LABEL_WORKING,
  branchNameForIssue,
  buildAgentEnv,
  buildPrompt,
  buildRetryPrompt,
  checkDailyBudget,
  decideToolUse,
  findProtectedPaths,
  isEligibleIssue,
  normalizeState,
  recordRun,
} from "./policy.js";

const REPO = "satou-aaaaa/sandbox";
const BASE = "main";
const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = resolve(AGENT_DIR, "..");
/** 1件あたりの上限（暴走・費用超過の歯止め） */
const MAX_TURNS = 40;
const MAX_BUDGET_USD = 3;
/** 1回のエージェント実行の壁時計上限（ハング対策） */
const AGENT_TIMEOUT_MS = 20 * 60 * 1000;
/** 使用モデル（環境変数 AGENT_MODEL で上書き可）。 */
const MODEL = process.env.AGENT_MODEL || "claude-sonnet-5-5";
/** 状態・監査ログの置き場（.gitignore済み。実データは含まない） */
const STATE_FILE = join(AGENT_DIR, ".state", "daily.json");
const LOG_DIR = join(AGENT_DIR, "logs");
/** このファイルが存在する間はループを実行しない（キルスイッチ）。 */
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const COMMIT_TRAILER = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";
const PR_TRAILER = "🤖 Generated with [Claude Code](https://claude.com/claude-code)";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_ISSUE = args.includes("--issue") ? Number(args[args.indexOf("--issue") + 1]) : null;
const MAX_ISSUES = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 1;

/** コマンドを実行して標準出力を返す（引数は配列で渡し、シェル展開を避ける）。 */
function run(cmd, cmdArgs, cwd = REPO_ROOT) {
  return execFileSync(cmd, cmdArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // Windowsでは npm が .cmd のためシェル経由が必要（引数は固定の安全な値のみ）
    shell: process.platform === "win32" && cmd === "npm",
  }).trim();
}

function gh(...ghArgs) {
  return run("gh", ghArgs);
}

function log(msg) {
  console.log(`[agent] ${msg}`);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadState() {
  try {
    return normalizeState(JSON.parse(readFileSync(STATE_FILE, "utf8")), today());
  } catch {
    return normalizeState(null, today());
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

function ensureLabels() {
  const labels = [
    [LABEL_READY, "0e8a16", "エージェントが着手してよいIssue"],
    [LABEL_WORKING, "fbca04", "エージェントが処理中"],
    [LABEL_DONE, "5319e7", "エージェントがPRを作成済み"],
    [LABEL_PR, "1d76db", "エージェントが作成したPR（人手レビュー必須）"],
  ];
  for (const [name, color, description] of labels) {
    gh("label", "create", name, "--repo", REPO, "--color", color, "--description", description, "--force");
  }
}

/** @returns {import("./policy.js").IssueSummary[]} */
function fetchCandidates() {
  const json = gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_READY, "--json", "number,title,body,author,labels", "--limit", "50");
  /** @type {import("./policy.js").IssueSummary[]} */
  const issues = JSON.parse(json);
  return issues
    .filter((i) => ONLY_ISSUE === null || i.number === ONLY_ISSUE)
    .filter((i) => {
      const ok = isEligibleIssue(i);
      if (!ok) log(`#${i.number} は対象外（起票者またはラベル条件を満たしません）`);
      return ok;
    })
    .slice(0, MAX_ISSUES);
}

/**
 * エージェントを1回実行する。PreToolUseフックで全ツール呼び出しを監査ログへ記録し、
 * policy.decideToolUse で二重に可否判定する（許可リストと独立した最終防衛線。
 * フックのdenyはどの権限モードでも効く）。
 * @param {string} prompt
 * @param {string} workDir
 * @param {string} auditFile
 * @returns {Promise<{ok: boolean, cost: number, summary: string}>}
 */
async function runAgent(prompt, workDir, auditFile) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS);
  const audit = (entry) => appendFileSync(auditFile, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
  /** @type {import("@anthropic-ai/claude-agent-sdk").HookCallback} */
  const preToolUse = async (input) => {
    const { tool_name: tool, tool_input: toolInput } = /** @type {any} */ (input);
    const verdict = decideToolUse(tool, toolInput ?? {}, workDir);
    audit({ event: "tool", tool, input: toolInput, decision: verdict.decision, reason: verdict.decision === "deny" ? verdict.reason : undefined });
    if (verdict.decision === "deny") {
      return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.reason } };
    }
    return {};
  };
  let cost = 0;
  let ok = false;
  let summary = "";
  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: workDir,
        model: MODEL,
        abortController,
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        permissionMode: "dontAsk",
        allowedTools: ALLOWED_TOOLS,
        disallowedTools: DISALLOWED_TOOLS,
        hooks: { PreToolUse: [{ hooks: [preToolUse] }] },
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        env: buildAgentEnv(process.env),
        persistSession: false,
      },
    })) {
      if (message.type === "result") {
        cost = message.total_cost_usd ?? 0;
        ok = message.subtype === "success";
        summary = "result" in message ? String(message.result ?? "") : "";
        audit({ event: "result", subtype: message.subtype, cost, turns: message.num_turns });
        log(`エージェント終了: ${message.subtype}（費用 $${cost.toFixed(4)}, ${message.num_turns}ターン）`);
      }
    }
  } catch (err) {
    audit({ event: "error", message: err instanceof Error ? err.message : String(err) });
    log(`エージェント実行エラー: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
  return { ok, cost, summary };
}

/**
 * 検証コマンドを順に実行し、最初の失敗を返す。
 * @param {string} workDir
 * @returns {{name: string, output: string} | null}
 */
function verify(workDir) {
  for (const script of [["test"], ["run", "typecheck"], ["run", "lint"], ["run", "check-secrets"]]) {
    try {
      run("npm", script, workDir);
    } catch (err) {
      const e = /** @type {any} */ (err);
      return { name: `npm ${script.join(" ")}`, output: `${e.stdout ?? ""}\n${e.stderr ?? ""}` };
    }
  }
  return null;
}

/** @param {string} workDir @returns {string[]} 変更ファイル一覧 */
function changedFiles(workDir) {
  return run("git", ["status", "--porcelain"], workDir)
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3));
}

/** @param {import("./policy.js").IssueSummary} issue */
async function processIssue(issue) {
  const branch = branchNameForIssue(issue.number);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-agent-")), `issue-${issue.number}`);
  log(`#${issue.number} 「${issue.title}」を処理します（worktree: ${workDir}）`);

  gh("issue", "edit", String(issue.number), "--repo", REPO, "--add-label", LABEL_WORKING, "--remove-label", LABEL_READY);
  const giveBack = (reason) => {
    gh("issue", "edit", String(issue.number), "--repo", REPO, "--remove-label", LABEL_WORKING, "--add-label", LABEL_READY);
    gh("issue", "comment", String(issue.number), "--repo", REPO, "--body", `エージェントは自動処理を中止しました: ${reason}\n\n人手で対応するか、条件を整えてから \`${LABEL_READY}\` を付け直してください。`);
    log(`#${issue.number} 中止: ${reason}`);
  };

  try {
    run("git", ["fetch", "origin", BASE]);
    run("git", ["worktree", "add", "-B", branch, workDir, `origin/${BASE}`]);
    run("npm", ["ci", "--no-audit", "--no-fund"], workDir);

    mkdirSync(LOG_DIR, { recursive: true });
    const auditFile = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-issue-${issue.number}.jsonl`);
    log(`監査ログ: ${auditFile}`);

    const first = await runAgent(buildPrompt(issue), workDir, auditFile);
    let cost = first.cost;
    let summary = first.summary;
    saveState(recordRun(loadState(), first.cost));
    if (!first.ok) return giveBack("エージェントが正常終了しませんでした（ターン/予算/時間の上限、またはエラー）");

    const changed = changedFiles(workDir);
    if (changed.length === 0) return giveBack("変更が生成されませんでした");
    const protectedHits = findProtectedPaths(changed);
    if (protectedHits.length > 0) return giveBack(`保護対象パスへの変更が含まれていました: ${protectedHits.join(", ")}`);

    // 検証に失敗した場合は、失敗出力を渡して1回だけ修正させる（評価→最適化パターン）。
    let failure = verify(workDir);
    if (failure) {
      log(`#${issue.number} 検証失敗（${failure.name}）。1回だけ修正を依頼します`);
      const retry = await runAgent(buildRetryPrompt(failure.name, failure.output), workDir, auditFile);
      cost += retry.cost;
      // 実行回数は1件として数えるため、費用のみ加算する
      const s = loadState();
      saveState({ ...s, costUsd: s.costUsd + retry.cost });
      if (retry.summary) summary = retry.summary;
      if (!retry.ok) return giveBack("修正依頼が正常終了しませんでした");
      const after = findProtectedPaths(changedFiles(workDir));
      if (after.length > 0) return giveBack(`保護対象パスへの変更が含まれていました: ${after.join(", ")}`);
      failure = verify(workDir);
      if (failure) return giveBack(`検証 \`${failure.name}\` に失敗しました（修正後も未解決）`);
    }

    run("git", ["add", "-A"], workDir);
    run("git", ["commit", "-m", `agent: Issue #${issue.number} ${issue.title}\n\n${COMMIT_TRAILER}`], workDir);
    run("git", ["push", "--force-with-lease", "-u", "origin", branch], workDir);

    const body = [
      `Closes #${issue.number}`,
      "",
      "## エージェントによる要約",
      summary || "(要約なし)",
      "",
      "## レビュー観点（人手必須）",
      "- 法令根拠・判定ロジックに影響する変更でないか（該当する場合は根拠URLの確認）",
      "- 追加テストが要件を実際に検証しているか",
      "- 実データが含まれていないか",
      "",
      `検証済み: npm test / typecheck / lint / check-secrets（エージェント実行環境）。費用: $${cost.toFixed(4)}。監査ログ: 実行端末の agent/logs/`,
      "",
      PR_TRAILER,
    ].join("\n");
    const prUrl = gh("pr", "create", "--repo", REPO, "--base", BASE, "--head", branch, "--title", `agent: ${issue.title}`, "--body", body, "--label", LABEL_PR);
    gh("issue", "edit", String(issue.number), "--repo", REPO, "--remove-label", LABEL_WORKING, "--add-label", LABEL_DONE);
    log(`#${issue.number} PRを作成しました: ${prUrl}`);
  } catch (err) {
    giveBack(`予期しないエラー: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    try {
      run("git", ["worktree", "remove", "--force", workDir]);
      rmSync(dirname(workDir), { recursive: true, force: true });
    } catch {
      /* 後始末の失敗は処理結果に影響させない */
    }
  }
}

async function main() {
  if (DRY_RUN) {
    const issues = fetchCandidates();
    log(`ドライラン: 対象 ${issues.length} 件`);
    for (const i of issues) {
      log(`  #${i.number} ${i.title}`);
    }
    log(`許可ツール: ${ALLOWED_TOOLS.join(", ")}`);
    log(`禁止ツール: ${DISALLOWED_TOOLS.join(", ")}`);
    log(`モデル: ${MODEL} / 壁時計上限 ${AGENT_TIMEOUT_MS / 60000}分 / 本日の状態: ${JSON.stringify(loadState())}`);
    log(`上限: ${MAX_TURNS}ターン / $${MAX_BUDGET_USD} / 1実行あたり最大${MAX_ISSUES}件`);
    return;
  }
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です（agent/.disabled または AGENT_DISABLED=1）。何もせず終了します");
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が未設定です。");
    process.exit(1);
  }
  ensureLabels();
  const issues = fetchCandidates();
  log(`対象 ${issues.length} 件`);
  for (const issue of issues) {
    const budget = checkDailyBudget(loadState());
    if (!budget.allowed) {
      log(`中断: ${budget.reason}`);
      break;
    }
    await processIssue(issue);
  }
}

await main();
