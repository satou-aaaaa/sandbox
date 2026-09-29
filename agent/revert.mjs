#!/usr/bin/env node
/**
 * 事後の取消（リバート）。原則は「マージ前に人が承認しない」ため、問題があれば事後に取り消す。
 *
 * 取り消しの契機（--sweep で両方を点検する）:
 *   1. 所有者がマージ済みPRに `agent-revert` ラベルを付けた（人による取消。1操作）
 *   2. mainのCIが、エージェントのPRのマージ直後に失敗した（自動。一時的な失敗の誤検知を避けるため、
 *      まず1回再実行し、再実行後も失敗した場合だけ取り消す）
 *
 * 取り消しの手順: `git revert` でリバートPRを作り、必須チェック成功後に自動マージする。
 * 元のIssueは再オープンし、失敗の記録（教訓）を付けて再挑戦させる（最大2回）。上限に達したら人手に回す。
 *
 * 使い方:
 *   node revert.mjs --sweep              点検して、必要なら取り消す
 *   node revert.mjs --pr <番号> [--reason "理由"]   指定したマージ済みPRを取り消す
 *   node revert.mjs --sweep --dry-run    何もせず、取り消し対象だけ表示する
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 12）
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LABEL_DONE,
  LABEL_NEEDS_HUMAN,
  LABEL_READY,
  LABEL_REVERT,
  LABEL_REVERTED,
  LABEL_REVERT_PR,
  LESSON_MARKER,
  decideMainFailure,
  decideRetry,
  issueNumberFromBranch,
} from "./policy.js";
import { BASE, REPO, gh, log, run } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SWEEP = args.includes("--sweep");
const PR_ARG = args.includes("--pr") ? args[args.indexOf("--pr") + 1] : null;
const REASON_ARG = args.includes("--reason") ? args[args.indexOf("--reason") + 1] : null;
const COMMIT_TRAILER = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";
const PR_TRAILER = "🤖 Generated with [Claude Code](https://claude.com/claude-code)";

function ensureLabels() {
  for (const [name, color, description] of [
    [LABEL_REVERTED, "b60205", "取り消し（リバート）済みのPR"],
    [LABEL_REVERT_PR, "b60205", "エージェントが作成したリバートPR"],
    [LABEL_REVERT, "b60205", "所有者が付けると、このPR（マージ済み）を取り消す"],
  ]) {
    gh("label", "create", name, "--repo", REPO, "--color", color, "--description", description, "--force");
  }
}

/**
 * マージ済みPRを取り消す。成功したら true。
 * @param {number} prNumber
 * @param {string} reason 取り消しの理由（Issueに教訓として残す）
 * @param {string} [logExcerpt] 失敗ログの抜粋（教訓に含める）
 * @returns {boolean}
 */
function revertPr(prNumber, reason, logExcerpt = "") {
  const info = JSON.parse(gh("pr", "view", String(prNumber), "--repo", REPO, "--json", "number,title,state,mergeCommit,headRefName,labels,body"));
  if (info.state !== "MERGED" || !info.mergeCommit?.oid) {
    log(`PR #${prNumber}: マージ済みではないため取り消せません`);
    return false;
  }
  if (info.labels.some((l) => l.name === LABEL_REVERTED)) {
    log(`PR #${prNumber}: 取り消し済みです`);
    return false;
  }
  const sha = info.mergeCommit.oid;
  run("git", ["fetch", "origin", BASE]);
  // 既に取り消されていれば、二重にリバートしない
  if (run("git", ["log", `origin/${BASE}`, "--grep", `This reverts commit ${sha}`, "--format=%H"]).trim() !== "") {
    log(`PR #${prNumber}: mainに既にリバートのコミットがあります`);
    if (!DRY_RUN) gh("pr", "edit", String(prNumber), "--repo", REPO, "--add-label", LABEL_REVERTED);
    return false;
  }
  if (DRY_RUN) {
    log(`[dry-run] PR #${prNumber}「${info.title}」を取り消します: ${reason}`);
    return true;
  }
  ensureLabels();
  const branch = `revert/pr-${prNumber}`;
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-agent-")), `revert-${prNumber}`);
  const title = `revert: ${info.title} (#${prNumber})`;
  /** @type {boolean} */
  let ok;
  try {
    run("git", ["worktree", "add", "-B", branch, workDir, `origin/${BASE}`]);
    try {
      run("git", ["revert", "--no-edit", sha], workDir);
    } catch {
      try {
        run("git", ["revert", "--abort"], workDir);
      } catch {
        /* 中断の失敗は無視する */
      }
      gh("pr", "comment", String(prNumber), "--repo", REPO, "--body", `自動リバートを試みましたが、競合のため自動では取り消せませんでした。人手での対応が必要です。\n\n理由: ${reason}`);
      return false;
    }
    const message = `${title}\n\nThis reverts commit ${sha}.\n\n理由: ${reason}\n\n${COMMIT_TRAILER}`;
    run("git", ["commit", "--amend", "-m", message], workDir);
    run("git", ["push", "-u", "origin", branch], workDir);
    const body = [`PR #${prNumber} を取り消します（自動リバート）。`, "", `理由: ${reason}`, "", "必須チェック成功後に自動でマージされます。", "", PR_TRAILER].join("\n");
    const revertUrl = gh("pr", "create", "--repo", REPO, "--base", BASE, "--head", branch, "--title", title, "--body", body, "--label", LABEL_REVERT_PR);
    gh("pr", "merge", revertUrl, "--repo", REPO, "--auto", "--squash");
    gh("pr", "edit", String(prNumber), "--repo", REPO, "--add-label", LABEL_REVERTED);
    gh("pr", "comment", String(prNumber), "--repo", REPO, "--body", `取り消しました（リバートPR: ${revertUrl}）。\n\n理由: ${reason}`);
    log(`PR #${prNumber} を取り消すPRを作成しました: ${revertUrl}`);
    ok = true;
  } finally {
    try {
      run("git", ["worktree", "remove", "--force", workDir]);
      rmSync(dirname(workDir), { recursive: true, force: true });
    } catch {
      /* 後始末の失敗は結果に影響させない */
    }
  }
  if (ok) reopenIssue(info, reason, logExcerpt);
  return ok;
}

/**
 * 取り消したPRの元のIssueを再オープンし、失敗の記録を添えて再挑戦させる（または人手に回す）。
 * @param {{headRefName: string, number: number, title: string}} info
 * @param {string} reason
 * @param {string} logExcerpt
 */
function reopenIssue(info, reason, logExcerpt) {
  const issueNo = issueNumberFromBranch(info.headRefName);
  if (issueNo === null) return;
  const issue = JSON.parse(gh("issue", "view", String(issueNo), "--repo", REPO, "--json", "labels,state"));
  const decision = decideRetry(issue.labels);
  if (issue.state === "CLOSED") gh("issue", "reopen", String(issueNo), "--repo", REPO);
  const lesson = [
    LESSON_MARKER,
    `PR #${info.number}「${info.title}」は取り消されました。`,
    "",
    `取り消しの理由: ${reason}`,
    logExcerpt ? `\n失敗ログ（抜粋）:\n\`\`\`\n${logExcerpt}\n\`\`\`` : "",
    "",
    decision.reason,
  ].join("\n");
  if (decision.retry) {
    gh("issue", "edit", String(issueNo), "--repo", REPO, "--remove-label", LABEL_DONE, "--remove-label", LABEL_NEEDS_HUMAN, "--add-label", String(decision.nextLabel), "--add-label", LABEL_READY);
    gh("label", "create", String(decision.nextLabel), "--repo", REPO, "--color", "fbca04", "--description", "取り消し後の再挑戦の回数", "--force");
  } else {
    gh("issue", "edit", String(issueNo), "--repo", REPO, "--remove-label", LABEL_DONE, "--add-label", LABEL_NEEDS_HUMAN);
  }
  gh("issue", "comment", String(issueNo), "--repo", REPO, "--body", lesson);
}

/** 所有者が agent-revert ラベルを付けたマージ済みPRを取り消す。 */
function sweepLabeled() {
  const prs = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "merged", "--label", LABEL_REVERT, "--json", "number,labels", "--limit", "20"));
  for (const pr of prs) {
    if (pr.labels.some((l) => l.name === LABEL_REVERTED)) continue;
    revertPr(pr.number, "所有者の指示（agent-revert ラベル）");
  }
}

/** mainのCIが、エージェントのPRのマージ直後に失敗していれば、再実行または取り消しをする。 */
function sweepMainFailure() {
  const runs = JSON.parse(gh("run", "list", "--repo", REPO, "--workflow", "test.yml", "--branch", BASE, "--event", "push", "--limit", "1", "--json", "databaseId,status,conclusion,headSha,attempt"));
  if (runs.length === 0) return;
  const latest = runs[0];
  run("git", ["fetch", "origin", BASE]);
  const isHead = run("git", ["rev-parse", `origin/${BASE}`]).trim() === latest.headSha;
  let prHeadRef = null;
  let prNumber = null;
  let alreadyReverted = false;
  try {
    const pulls = JSON.parse(gh("api", `repos/${REPO}/commits/${latest.headSha}/pulls`));
    if (pulls.length > 0) {
      prNumber = pulls[0].number;
      prHeadRef = pulls[0].head.ref;
      alreadyReverted = pulls[0].labels.some((l) => l.name === LABEL_REVERTED);
    }
  } catch {
    /* PRを特定できなければ、取り消さない */
  }
  const action = decideMainFailure({ status: latest.status, conclusion: latest.conclusion, attempt: latest.attempt ?? 1, isHead, prHeadRef, alreadyReverted });
  if (action === "skip" || prNumber === null) return;
  if (action === "rerun") {
    log(`mainのCIが失敗しました（PR #${prNumber} の直後）。一時的な失敗の可能性があるため、まず1回再実行します`);
    if (!DRY_RUN) gh("run", "rerun", String(latest.databaseId), "--repo", REPO, "--failed");
    return;
  }
  let excerpt = "";
  try {
    excerpt = gh("run", "view", String(latest.databaseId), "--repo", REPO, "--log-failed").split("\n").slice(-40).join("\n").slice(-2500);
  } catch {
    /* ログを取得できなくても取り消しは行う */
  }
  log(`mainのCIが再実行後も失敗しました。PR #${prNumber} を取り消します`);
  revertPr(prNumber, `マージ直後にmainのCIが失敗しました（再実行後も失敗。run ${latest.databaseId}）`, excerpt);
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (PR_ARG) {
    if (!(PR_ARG.length > 0 && [...PR_ARG].every((c) => c >= "0" && c <= "9"))) {
      console.error("--pr にはPR番号（数字）を指定してください");
      process.exit(2);
    }
    revertPr(Number(PR_ARG), REASON_ARG ?? "指定による取り消し");
    return;
  }
  if (!SWEEP) {
    console.error("使い方: node revert.mjs --sweep | --pr <番号> [--reason 理由]");
    process.exit(2);
  }
  sweepLabeled();
  sweepMainFailure();
}

await main();
