#!/usr/bin/env node
/**
 * AIレビュアー（承認ゲート）。
 *
 * 承認が必要と判定されたエージェントのPR（`agent-needs-review`。法令ロジック・設定・設計文書など）を、
 * 実装したエージェントとは独立した読み取り専用のレビュアー（別の強いモデル・観点の異なる2回）が
 * レビューする。**全員一致で承認**のときだけ `agent-approved` を付け（既存の自動マージに乗る）、
 * 不承認なら理由をコメントして `agent-changes-requested` を付ける。
 *
 * 承認しないもの: 保護パスの変更（信頼の根拠）、CIが未完了・失敗のPR、差分が大きすぎるPR。
 * 判定を解釈できない場合や、レビュアーの実行に失敗した場合は、必ず不承認（フェイルクローズ）。
 *
 * 使い方:
 *   node review.mjs --dry-run    判定結果を表示するのみ（ラベル・コメントは変更しない）
 *   node review.mjs              レビューして、承認または不承認のラベルを付ける（最大 --max 件。既定2）
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 11）
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DAILY_LIMITS,
  LABEL_AI_REVIEWED,
  LABEL_APPROVED,
  LABEL_CHANGES_REQUESTED,
  REVIEW_FOCUSES,
  REVIEW_MAX_DIFF_CHARS,
  buildReviewPrompt,
  classifyPrRisk,
  decideReview,
  isReviewCandidate,
  parseReviewVerdict,
} from "./policy.js";
import { runAgent } from "./runner.mjs";
import { AUTH, LOG_DIR, REPO, SANDBOX, buildImage, dockerAvailable, dockerPhase, gh, loadState, log, run, saveState } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX_PRS = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 2;

/** ブランチ名 agent/issue-<数字> からIssue番号を取り出す。形式が違えば null。 */
function issueNumberOf(headRef) {
  const prefix = "agent/issue-";
  if (!headRef.startsWith(prefix)) return null;
  const rest = headRef.slice(prefix.length);
  return rest !== "" && [...rest].every((c) => c >= "0" && c <= "9") ? Number(rest) : null;
}

/** 必須チェックがすべて完了して成功（またはスキップ）しているか。 */
function checksGreen(rollup) {
  if (!Array.isArray(rollup) || rollup.length === 0) return false;
  return rollup.every((c) => {
    const state = c.conclusion ?? c.state ?? "";
    return c.status === undefined || c.status === "COMPLETED" ? ["SUCCESS", "SKIPPED", "NEUTRAL"].includes(state) : false;
  });
}

/** 1つのPRを、観点の異なる独立したレビュアーで順にレビューする。 */
async function reviewPr(pr, files, legal) {
  const issueNo = issueNumberOf(pr.headRefName);
  const issue = JSON.parse(gh("issue", "view", String(issueNo), "--repo", REPO, "--json", "number,title,body"));
  const diff = gh("pr", "diff", String(pr.number), "--repo", REPO);
  if (diff.length > REVIEW_MAX_DIFF_CHARS) return { tooLarge: true, verdicts: [], cost: 0 };

  run("git", ["fetch", "origin", `pull/${pr.number}/head`]);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-triage-")), "tree");
  run("git", ["worktree", "add", "--detach", workDir, "FETCH_HEAD"]);
  const verdicts = [];
  let cost = 0;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    for (const focus of REVIEW_FOCUSES) {
      const prompt = buildReviewPrompt({ issue, prTitle: pr.title, files, diff, legal, focus });
      const auditName = `${new Date().toISOString().replace(/[:.]/g, "-")}-review-pr-${pr.number}-${focus.key}.jsonl`;
      const res = SANDBOX === "docker" ? dockerPhase("review", workDir, auditName, prompt) : await runAgent(prompt, workDir, join(LOG_DIR, auditName), "review");
      cost += res.cost ?? 0;
      verdicts.push(res.ok ? parseReviewVerdict(res.summary) : null);
      log(`  レビュー（${focus.label}）: ${verdicts[verdicts.length - 1] ? (verdicts[verdicts.length - 1].approve ? "承認" : "不承認") : "解釈不能/失敗（不承認扱い）"}`);
    }
  } finally {
    try {
      run("git", ["worktree", "remove", "--force", workDir]);
      rmSync(dirname(workDir), { recursive: true, force: true });
    } catch {
      /* 後始末の失敗は結果に影響させない */
    }
  }
  return { tooLarge: false, verdicts, cost };
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  const prs = JSON.parse(
    gh("pr", "list", "--repo", REPO, "--state", "open", "--json", "number,title,headRefName,labels,isDraft,statusCheckRollup", "--limit", "30"),
  ).filter((p) => issueNumberOf(p.headRefName) !== null);

  const allowLegal = process.env.AGENT_AUTOMERGE_LEGAL === "true";
  /** @type {{pr: any, files: string[], legal: boolean}[]} */
  const targets = [];
  for (const pr of prs) {
    const files = JSON.parse(gh("pr", "view", String(pr.number), "--repo", REPO, "--json", "files")).files;
    const risk = classifyPrRisk(files.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions })), { allowLegal });
    const cand = isReviewCandidate(pr, risk);
    if (!cand.eligible) continue;
    if (!checksGreen(pr.statusCheckRollup)) {
      log(`PR #${pr.number}: 必須チェックが未完了または失敗のため、レビューを見送ります`);
      continue;
    }
    targets.push({ pr, files: files.map((f) => f.path), legal: risk.reasons.some((r) => r.includes("法令判定")) });
  }
  log(`AIレビュー対象 ${targets.length} 件（隔離: ${SANDBOX}）`);
  if (targets.length === 0) return;
  if (loadState().costUsd >= DAILY_LIMITS.maxCostUsd) {
    log("中断: 本日の費用上限に達しました");
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
    for (const [name, color, description] of [
      [LABEL_APPROVED, "0e8a16", "承認済み（所有者、またはAIレビュアー）。CI成功後に自動マージ"],
      [LABEL_AI_REVIEWED, "ededed", "AIレビュー済み"],
      [LABEL_CHANGES_REQUESTED, "d93f0b", "AIレビューで不承認。修正が必要"],
    ]) {
      gh("label", "create", name, "--repo", REPO, "--color", color, "--description", description, "--force");
    }
  }
  for (const { pr, files, legal } of targets.slice(0, MAX_PRS)) {
    log(`PR #${pr.number} 「${pr.title}」をレビューします（法令領域: ${legal ? "はい" : "いいえ"}）`);
    const { tooLarge, verdicts, cost } = await reviewPr(pr, files, legal);
    const s = loadState();
    saveState({ ...s, costUsd: s.costUsd + cost });
    const decision = tooLarge ? { approve: false, reasons: ["差分が大きすぎるため、AIレビューの対象外です（人手または分割が必要）"] } : decideReview(verdicts, { legal });
    log(`PR #${pr.number} → ${decision.approve ? "承認" : "不承認"}: ${decision.reasons.join(" / ")}`);
    if (DRY_RUN) continue;
    const listing = decision.reasons.map((r) => `- ${r}`).join("\n");
    if (decision.approve) {
      gh("pr", "edit", String(pr.number), "--repo", REPO, "--add-label", LABEL_APPROVED, "--add-label", LABEL_AI_REVIEWED);
      gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `AIレビュー: **承認**（独立した${REVIEW_FOCUSES.length}観点の全員一致）。必須チェック成功後に自動マージされます。\n\n${listing}\n\n問題があれば、このPRに \`agent-revert\` ラベルを付けると取り消されます。`);
    } else {
      gh("pr", "edit", String(pr.number), "--repo", REPO, "--add-label", LABEL_AI_REVIEWED, "--add-label", LABEL_CHANGES_REQUESTED);
      gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `AIレビュー: **不承認**（マージしません）。\n\n${listing}\n\n修正が必要です。人が確認して問題なければ、\`agent-approved\` ラベルを付けると自動マージされます。`);
    }
  }
}

await main();
