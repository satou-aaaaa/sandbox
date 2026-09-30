#!/usr/bin/env node
/**
 * 自己修復: CIが失敗した、またはAIレビューで不承認となったエージェントのPRを、フィードバック
 * （失敗ログ・指摘）を渡して、同じブランチ上で修正させる。人手を介さず問題を解消するための仕組み。
 *
 * 修正は最大2回（agent-fix-1/2）。上限に達したら agent-needs-human に回す。
 * 修正後はAIレビューを再度受け直す（agent-ai-reviewed / agent-changes-requested を外す）。
 * 実装と同じ多層防御（許可リスト・フック・保護パス検査・検証ゲート・Docker隔離）で動く。
 *
 * 使い方:
 *   node fix.mjs --dry-run    対象と、対応の内容を表示するのみ
 *   node fix.mjs              最大 --max 件（既定1）を修正する
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 13）
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LABEL_AI_REVIEWED,
  LABEL_CHANGES_REQUESTED,
  LABEL_FIX_PREFIX,
  LABEL_NEEDS_HUMAN,
  buildFixPrompt,
  buildRetryPrompt,
  checkDailyBudget,
  decideFix,
  findProtectedPaths,
  fixCount,
  issueNumberFromBranch,
  recordRun,
} from "./policy.js";
import { AUTH, REPO, SANDBOX, backend, buildImage, changedFiles, dockerAvailable, gh, loadState, log, run, saveState, LOG_DIR } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX_PRS = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 1;
const COMMIT_TRAILER = "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>";

/** 失敗したCIの実行ログ（失敗したステップの末尾）を集める。 */
function collectCiFeedback(headRef) {
  const runs = JSON.parse(gh("run", "list", "--repo", REPO, "--branch", headRef, "--limit", "6", "--json", "databaseId,conclusion,name,status"));
  const failed = runs.filter((r) => r.status === "completed" && r.conclusion === "failure").slice(0, 2);
  const parts = [];
  for (const r of failed) {
    /** @type {string} */
    let excerpt;
    try {
      excerpt = gh("run", "view", String(r.databaseId), "--repo", REPO, "--log-failed").split("\n").slice(-60).join("\n").slice(-4000);
    } catch {
      excerpt = "(ログを取得できませんでした)";
    }
    parts.push(`### 失敗したCI: ${r.name}（run ${r.databaseId}）\n${excerpt}`);
  }
  return parts.join("\n\n");
}

/** AIレビューの不承認コメント（直近1件）を集める。 */
function collectReviewFeedback(prNumber) {
  const comments = JSON.parse(gh("pr", "view", String(prNumber), "--repo", REPO, "--json", "comments")).comments;
  const last = comments.filter((c) => typeof c.body === "string" && c.body.includes("AIレビュー: **不承認**")).slice(-1)[0];
  return last ? `### AIレビューの指摘\n${last.body}` : "";
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  const prs = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "open", "--json", "number,title,headRefName,labels,isDraft,statusCheckRollup", "--limit", "30"));
  const targets = prs.map((pr) => ({ pr, decision: decideFix(pr) })).filter((t) => t.decision.action !== "skip");
  log(`自己修復の対象 ${targets.length} 件（隔離: ${SANDBOX}）`);
  if (targets.length === 0) return;

  // 上限に達したものは人手に回す（エージェントは動かさない）
  for (const { pr, decision } of targets.filter((t) => t.decision.action === "escalate")) {
    log(`PR #${pr.number}: ${decision.reason}`);
    if (DRY_RUN) continue;
    gh("pr", "edit", String(pr.number), "--repo", REPO, "--add-label", LABEL_NEEDS_HUMAN);
    gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `自己修復を${fixCount(pr.labels)}回試みましたが解消しませんでした。人手での対応が必要です。\n\n${decision.reason}`);
  }
  const fixes = targets.filter((t) => t.decision.action === "fix").slice(0, MAX_PRS);
  if (fixes.length === 0) return;
  if (!checkDailyBudget(loadState()).allowed) {
    log("中断: 本日の上限に達しました");
    return;
  }
  if (AUTH.error) {
    console.error(AUTH.error);
    process.exit(1);
  }
  if (SANDBOX === "docker") {
    if (!dockerAvailable()) {
      console.error("Dockerに接続できません。Docker Desktopを起動するか、AGENT_SANDBOX=none を明示してください。");
      process.exit(1);
    }
    buildImage();
  }
  if (!DRY_RUN) {
    for (const n of [1, 2]) gh("label", "create", `${LABEL_FIX_PREFIX}${n}`, "--repo", REPO, "--color", "fbca04", "--description", "自己修復の回数", "--force");
  }
  for (const { pr, decision } of fixes) await fixPr(pr, decision);
}

/** @param {any} pr @param {{kinds: ("ci"|"review")[], reason: string}} decision */
async function fixPr(pr, decision) {
  const issueNo = issueNumberFromBranch(pr.headRefName);
  const issue = JSON.parse(gh("issue", "view", String(issueNo), "--repo", REPO, "--json", "number,title,body"));
  const feedback = [decision.kinds.includes("ci") ? collectCiFeedback(pr.headRefName) : "", decision.kinds.includes("review") ? collectReviewFeedback(pr.number) : ""].filter(Boolean).join("\n\n");
  log(`PR #${pr.number} 「${pr.title}」: ${decision.reason}（フィードバック: ${decision.kinds.join("+")}）`);
  if (DRY_RUN) return;
  if (!feedback) {
    log(`PR #${pr.number}: 対応すべきフィードバックの内容を取得できなかったため、人手に回します`);
    gh("pr", "edit", String(pr.number), "--repo", REPO, "--add-label", LABEL_NEEDS_HUMAN);
    return;
  }

  const be = backend();
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-agent-")), `fix-${pr.number}`);
  const giveUp = (reason) => {
    log(`PR #${pr.number} 自己修復を中止: ${reason}`);
    gh("pr", "edit", String(pr.number), "--repo", REPO, "--add-label", `${LABEL_FIX_PREFIX}${fixCount(pr.labels) + 1}`);
    gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `自己修復を試みましたが、中止しました: ${reason}`);
  };
  try {
    run("git", ["fetch", "origin", `pull/${pr.number}/head`]);
    run("git", ["worktree", "add", "-B", pr.headRefName, workDir, "FETCH_HEAD"]);
    be.install(workDir);
    mkdirSync(LOG_DIR, { recursive: true });
    const auditFile = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-fix-pr-${pr.number}.jsonl`);
    const first = await be.agent(buildFixPrompt(issue, feedback), workDir, auditFile);
    saveState(recordRun(loadState(), first.cost));
    if (!first.ok) return giveUp("エージェントが正常終了しませんでした");
    if (changedFiles(workDir).length === 0) return giveUp("修正が生成されませんでした");
    const protectedHits = findProtectedPaths(changedFiles(workDir));
    if (protectedHits.length > 0) return giveUp(`保護対象パスへの変更が含まれていました: ${protectedHits.join(", ")}`);

    let failure = be.verify(workDir);
    if (failure) {
      const retry = await be.agent(buildRetryPrompt(failure.name, failure.output), workDir, auditFile);
      const s = loadState();
      saveState({ ...s, costUsd: s.costUsd + retry.cost });
      if (!retry.ok) return giveUp("修正後の検証に失敗し、再修正も完了しませんでした");
      const after = findProtectedPaths(changedFiles(workDir));
      if (after.length > 0) return giveUp(`保護対象パスへの変更が含まれていました: ${after.join(", ")}`);
      failure = be.verify(workDir);
      if (failure) return giveUp(`検証 ${failure.name} に失敗しました（修正後も未解決）`);
    }
    run("git", ["add", "-A"], workDir);
    run("git", ["commit", "-m", `agent-fix: PR #${pr.number} のフィードバックに対応（${decision.kinds.join("+")}）\n\n${COMMIT_TRAILER}`], workDir);
    run("git", ["push", "origin", `HEAD:${pr.headRefName}`], workDir);
    // 修正後は、AIレビューを最初から受け直す
    gh("pr", "edit", String(pr.number), "--repo", REPO, "--add-label", `${LABEL_FIX_PREFIX}${fixCount(pr.labels) + 1}`, "--remove-label", LABEL_CHANGES_REQUESTED, "--remove-label", LABEL_AI_REVIEWED);
    gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `フィードバック（${decision.kinds.join("+")}）に対応する修正を追加しました。CIとAIレビューを再度受けます。\n\n${first.summary.slice(0, 1500)}`);
    log(`PR #${pr.number}: 修正をpushしました`);
  } catch (err) {
    giveUp(`予期しないエラー: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    try {
      run("git", ["worktree", "remove", "--force", workDir]);
      rmSync(dirname(workDir), { recursive: true, force: true });
    } catch {
      /* 後始末の失敗は結果に影響させない */
    }
  }
}

await main();
