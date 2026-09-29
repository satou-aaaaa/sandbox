#!/usr/bin/env node
/**
 * GitHub Issue 自律処理ループ（オーケストレーター）。
 *
 * `agent-ready` ラベル付きのIssue（起票者が所有者本人のものだけ）を1件ずつ
 * 取り出し、隔離した git worktree でClaude Agent SDKに実装させ、
 * 検証（test/typecheck/lint）に通った場合のみ、ブランチをpushしてPRを作る。
 * 【マージは行わない】。マージ・押印相当の最終判断は常に人間が行う。
 *
 * 権限の分離:
 *   - エージェント: 作業ツリー内のファイル編集とテスト実行のみ（policy.js）
 *   - このスクリプト: commit / push / PR作成（決定的なコード。LLMは介在しない）
 *
 * 使い方:
 *   node run.mjs --dry-run           対象Issueとエージェント設定を表示（API呼び出しなし）
 *   node run.mjs                     agent-ready のIssueを最大 --max 件処理
 *   node run.mjs --issue 81          指定Issueのみ処理（ラベル条件は同じく必須）
 *
 * 前提: `gh` にログイン済み、環境変数 ANTHROPIC_API_KEY が設定済み。
 * 設計の根拠・運用上の注意: docs/adr/0017-agent-sdk-issue-loop.md
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
  findProtectedPaths,
  isEligibleIssue,
} from "./policy.js";

const REPO = "satou-aaaaa/sandbox";
const BASE = "main";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** 1件あたりの上限（暴走・費用超過の歯止め） */
const MAX_TURNS = 40;
const MAX_BUDGET_USD = 3;
const COMMIT_TRAILER = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";
const PR_TRAILER = "🤖 Generated with [Claude Code](https://claude.com/claude-code)";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_ISSUE = args.includes("--issue") ? Number(args[args.indexOf("--issue") + 1]) : null;
const MAX_ISSUES = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 1;

/** コマンドを（シェルを介さず）実行して標準出力を返す。 */
function run(cmd, cmdArgs, cwd = REPO_ROOT) {
  return execFileSync(cmd, cmdArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" && cmd === "npm" }).trim();
}

function gh(...ghArgs) {
  return run("gh", ghArgs);
}

function log(msg) {
  console.log(`[agent] ${msg}`);
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

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    let summary = "";
    let cost = 0;
    let ok = false;
    for await (const message of query({
      prompt: buildPrompt(issue),
      options: {
        cwd: workDir,
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        permissionMode: "dontAsk",
        allowedTools: ALLOWED_TOOLS,
        disallowedTools: DISALLOWED_TOOLS,
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
        log(`#${issue.number} エージェント終了: ${message.subtype}（費用 $${cost.toFixed(4)}, ${message.num_turns}ターン）`);
      }
    }
    if (!ok) return giveBack("エージェントが正常終了しませんでした（ターン/予算上限、またはエラー）");

    const changed = run("git", ["status", "--porcelain"], workDir)
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(3));
    if (changed.length === 0) return giveBack("変更が生成されませんでした");

    const protectedHits = findProtectedPaths(changed);
    if (protectedHits.length > 0) return giveBack(`保護対象パスへの変更が含まれていました: ${protectedHits.join(", ")}`);

    for (const script of [["test"], ["run", "typecheck"], ["run", "lint"]]) {
      try {
        run("npm", script, workDir);
      } catch {
        return giveBack(`検証 \`npm ${script.join(" ")}\` に失敗しました`);
      }
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
      `検証済み: npm test / typecheck / lint（エージェント実行環境）。費用: $${cost.toFixed(4)}`,
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
    log(`上限: ${MAX_TURNS}ターン / $${MAX_BUDGET_USD} / 1実行あたり最大${MAX_ISSUES}件`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が未設定です。");
    process.exit(1);
  }
  ensureLabels();
  const issues = fetchCandidates();
  log(`対象 ${issues.length} 件`);
  for (const issue of issues) await processIssue(issue);
}

await main();
