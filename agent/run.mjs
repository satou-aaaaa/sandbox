#!/usr/bin/env node
/**
 * GitHub Issue 自律処理ループ（オーケストレーター。ホスト側で動く）。
 *
 * `agent-ready` ラベル付きのIssue（起票者が所有者本人のものだけ）を1件ずつ
 * 取り出し、隔離した git worktree でClaude Agent SDKに実装させ、
 * 検証（test/typecheck/lint/check-secrets）に通った場合のみ、ブランチをpushして
 * PRを作る。【マージは行わない】。最終判断は常に人間が行う。
 *
 * 権限の分離:
 *   - ホスト（このスクリプト）: Issue選別 / worktree作成 / commit / push / PR作成。
 *     GitHub認証情報を持つのはここだけ。LLMは介在しない。
 *   - エージェント実行（install / agent / verify）: 既定ではDockerコンテナ内
 *     （AGENT_SANDBOX=docker。作業ツリーのみマウント・認証情報なし）。
 *     `AGENT_SANDBOX=none` を明示した場合のみホストで直接実行する（隔離なし）。
 *
 * 多層防御（docs/adr/0017-agent-sdk-issue-loop.md）:
 *   1. 許可リスト（dontAsk）＋拒否リスト  2. PreToolUseフックによる最終判定と監査ログ
 *   3. 保護パス検査  4. 検証ゲート  5. 日次上限・1件あたりの上限・壁時計上限
 *   6. キルスイッチ（agent/.disabled または AGENT_DISABLED=1）  7. コンテナ隔離
 *
 * 使い方:
 *   node run.mjs --dry-run           対象Issueとエージェント設定を表示（API呼び出しなし）
 *   node run.mjs                     agent-ready のIssueを最大 --max 件処理
 *   node run.mjs --issue 81          指定Issueのみ処理（ラベル条件は同じく必須）
 *
 * 前提: `gh` にログイン済み、Docker起動済み。認証は既定でClaudeサブスクリプション（追加課金なし）:
 *   Docker隔離時は `claude setup-token` で発行した CLAUDE_CODE_OAUTH_TOKEN を環境変数に設定する。
 *   APIキー（従量課金）を使う場合のみ AGENT_AUTH=api-key と ANTHROPIC_API_KEY を明示する。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
  DOCKER_IMAGE,
  LABEL_DONE,
  LABEL_PR,
  LABEL_READY,
  LABEL_WORKING,
  branchNameForIssue,
  buildDockerArgs,
  resolveAuth,
  buildLessons,
  buildPrompt,
  buildRetryPrompt,
  checkDailyBudget,
  findProtectedPaths,
  isEligibleIssue,
  normalizeState,
  recordRun,
  retryCount,
} from "./policy.js";
import { AGENT_TIMEOUT_MS, MAX_BUDGET_USD, MAX_TURNS, MODEL, installDeps, runAgent, verifyAll } from "./runner.mjs";

export const REPO = "satou-aaaaa/sandbox";
export const BASE = "main";
const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
export const REPO_ROOT = resolve(AGENT_DIR, "..");
/** 状態・監査ログの置き場（.gitignore済み。実データは含まない） */
const STATE_FILE = join(AGENT_DIR, ".state", "daily.json");
export const LOG_DIR = join(AGENT_DIR, "logs");
/** このファイルが存在する間はループを実行しない（キルスイッチ）。 */
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const COMMIT_TRAILER = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";
const PR_TRAILER = "🤖 Generated with [Claude Code](https://claude.com/claude-code)";
/** 隔離モード。docker（既定）または none（隔離なし。明示指定が必要）。 */
export const SANDBOX = process.env.AGENT_SANDBOX || "docker";
/** 認証方式の決定結果（subscription既定）。 */
/** コンテナの実行ユーザー。Linuxではホストのuid/gidに合わせる（Windows/Docker Desktopでは既定の1000）。 */
const HOST_UID = typeof process.getuid === "function" ? process.getuid() : 1000;
const HOST_GID = typeof process.getgid === "function" ? process.getgid() : 1000;
export const AUTH = resolveAuth(process.env, /** @type {"docker"|"none"} */ (SANDBOX === "none" ? "none" : "docker"));

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_ISSUE = args.includes("--issue") ? Number(args[args.indexOf("--issue") + 1]) : null;
const MAX_ISSUES = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 1;

/** コマンドを実行して標準出力を返す（引数は配列で渡し、シェル展開を避ける）。 */
export function run(cmd, cmdArgs, cwd = REPO_ROOT) {
  return execFileSync(cmd, cmdArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    // Windowsでは npm が .cmd のためシェル経由が必要（引数は固定の安全な値のみ）
    shell: process.platform === "win32" && cmd === "npm",
  }).trim();
}

export function gh(...ghArgs) {
  return run("gh", ghArgs);
}

export function log(msg) {
  console.log(`[agent] ${msg}`);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadState() {
  try {
    return normalizeState(JSON.parse(readFileSync(STATE_FILE, "utf8")), today());
  } catch {
    return normalizeState(null, today());
  }
}

export function saveState(state) {
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

// ---------------------------------------------------------------------------
// 実行バックエンド（docker: コンテナ内 / none: ホスト直接）
// ---------------------------------------------------------------------------

/** Dockerが使えるか（daemonに接続できるか）。 */
export function dockerAvailable() {
  try {
    run("docker", ["info", "--format", "{{.ServerVersion}}"]);
    return true;
  } catch {
    return false;
  }
}

/** 隔離イメージをビルドする（キャッシュが効くため毎回呼んでよい）。 */
export function buildImage() {
  run("docker", ["build", "-q", "-t", DOCKER_IMAGE, AGENT_DIR]);
}

/**
 * コンテナ内でフェーズを実行し、最終行の `RESULT:` JSONを返す。
 * @param {"install"|"agent"|"verify"|"triage"|"review"} phase
 * @param {string} workDir
 * @param {string} auditName
 * @param {string} [prompt] agentフェーズの依頼文
 * @returns {any}
 */
export function dockerPhase(phase, workDir, auditName, prompt) {
  const taskDir = mkdtempSync(join(tmpdir(), "kkt-task-"));
  try {
    if (prompt !== undefined) writeFileSync(join(taskDir, "prompt.txt"), prompt);
    mkdirSync(LOG_DIR, { recursive: true });
    const out = run("docker", buildDockerArgs({ phase, workDir, logDir: LOG_DIR, taskDir, auditName, authEnv: AUTH.error ? [] : AUTH.passEnv, uid: HOST_UID, gid: HOST_GID, env: process.env }));
    const line = out.split("\n").reverse().find((l) => l.startsWith("RESULT:"));
    if (!line) throw new Error(`コンテナからRESULTが返りませんでした（phase=${phase}）`);
    return JSON.parse(line.slice("RESULT:".length));
  } finally {
    rmSync(taskDir, { recursive: true, force: true });
  }
}

/** @returns {{install: (w: string) => void, agent: (p: string, w: string, a: string) => Promise<{ok: boolean, cost: number, summary: string}>, verify: (w: string) => {name: string, output: string} | null}} */
function backend() {
  if (SANDBOX === "docker") {
    return {
      install: (w) => void dockerPhase("install", w, ""),
      agent: async (p, w, a) => dockerPhase("agent", w, a.split(/[\\/]/).pop() ?? "audit.jsonl", p),
      verify: (w) => {
        const failure = dockerPhase("verify", w, "").failure;
        if (failure) return failure;
        // gitを使う check-secrets はホスト側で実行する（フックはmain由来で、エージェントは変更不可）
        try {
          run("npm", ["run", "check-secrets"], w);
          return null;
        } catch (err) {
          const e = /** @type {any} */ (err);
          return { name: "npm run check-secrets", output: `${e.stdout ?? ""}
${e.stderr ?? ""}` };
        }
      },
    };
  }
  return { install: installDeps, agent: runAgent, verify: verifyAll };
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
  const be = backend();
  log(`#${issue.number} 「${issue.title}」を処理します（隔離: ${SANDBOX} / worktree: ${workDir}）`);

  gh("issue", "edit", String(issue.number), "--repo", REPO, "--add-label", LABEL_WORKING, "--remove-label", LABEL_READY);
  const giveBack = (reason) => {
    gh("issue", "edit", String(issue.number), "--repo", REPO, "--remove-label", LABEL_WORKING, "--add-label", LABEL_READY);
    gh("issue", "comment", String(issue.number), "--repo", REPO, "--body", `エージェントは自動処理を中止しました: ${reason}\n\n人手で対応するか、条件を整えてから \`${LABEL_READY}\` を付け直してください。`);
    log(`#${issue.number} 中止: ${reason}`);
  };

  try {
    run("git", ["fetch", "origin", BASE]);
    run("git", ["worktree", "add", "-B", branch, workDir, `origin/${BASE}`]);
    be.install(workDir);

    mkdirSync(LOG_DIR, { recursive: true });
    const auditFile = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-issue-${issue.number}.jsonl`);
    log(`監査ログ: ${auditFile}`);

    // 取り消し後の再挑戦では、過去の失敗の記録（教訓）をプロンプトに含める
    const lessons = retryCount(issue.labels) > 0 ? buildLessons(JSON.parse(gh("issue", "view", String(issue.number), "--repo", REPO, "--json", "comments")).comments) : "";
    const first = await be.agent(buildPrompt(issue, lessons), workDir, auditFile);
    let cost = first.cost;
    let summary = first.summary;
    saveState(recordRun(loadState(), first.cost));
    if (!first.ok) return giveBack("エージェントが正常終了しませんでした（ターン/予算/時間の上限、またはエラー）");

    const changed = changedFiles(workDir);
    if (changed.length === 0) return giveBack("変更が生成されませんでした");
    const protectedHits = findProtectedPaths(changed);
    if (protectedHits.length > 0) return giveBack(`保護対象パスへの変更が含まれていました: ${protectedHits.join(", ")}`);

    // 検証に失敗した場合は、失敗出力を渡して1回だけ修正させる（評価→最適化パターン）。
    let failure = be.verify(workDir);
    if (failure) {
      log(`#${issue.number} 検証失敗（${failure.name}）。1回だけ修正を依頼します`);
      const retry = await be.agent(buildRetryPrompt(failure.name, failure.output), workDir, auditFile);
      cost += retry.cost;
      // 実行回数は1件として数えるため、費用のみ加算する
      const s = loadState();
      saveState({ ...s, costUsd: s.costUsd + retry.cost });
      if (retry.summary) summary = retry.summary;
      if (!retry.ok) return giveBack("修正依頼が正常終了しませんでした");
      const after = findProtectedPaths(changedFiles(workDir));
      if (after.length > 0) return giveBack(`保護対象パスへの変更が含まれていました: ${after.join(", ")}`);
      failure = be.verify(workDir);
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
      `検証済み: npm test / typecheck / lint / check-secrets（隔離: ${SANDBOX}）。費用: $${cost.toFixed(4)}。監査ログ: 実行端末の agent/logs/`,
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
  if (!["docker", "none"].includes(SANDBOX)) {
    console.error(`AGENT_SANDBOX は docker または none を指定してください（現在: ${SANDBOX}）`);
    process.exit(1);
  }
  if (DRY_RUN) {
    const issues = fetchCandidates();
    log(`ドライラン: 対象 ${issues.length} 件`);
    for (const i of issues) {
      log(`  #${i.number} ${i.title}`);
    }
    log(`隔離: ${SANDBOX}${SANDBOX === "docker" ? `（Docker ${dockerAvailable() ? "利用可能" : "利用不可"}）` : "（隔離なし・明示指定）"}`);
    log(`認証: ${AUTH.error ? `未設定（${AUTH.error}）` : AUTH.method === "subscription" ? "Claudeサブスクリプション（追加課金なし）" : "APIキー（従量課金）"}`);
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
  if (AUTH.error) {
    console.error(AUTH.error);
    process.exit(1);
  }
  if (SANDBOX === "docker") {
    // フェイルクローズ: 隔離が使えない場合は実行しない（隔離なしは AGENT_SANDBOX=none の明示が必要）
    if (!dockerAvailable()) {
      console.error("Dockerに接続できません。Docker Desktopを起動するか、隔離なしで実行する場合は AGENT_SANDBOX=none を明示してください。");
      process.exit(1);
    }
    buildImage();
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

// 他のスクリプト（triage.mjs）から共通処理をimportできるよう、直接実行時のみmainを走らせる
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
