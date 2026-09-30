#!/usr/bin/env node
/**
 * 意思決定資料の自動作成（#121）。
 *
 * 人手が必要と判定された（`agent-needs-human`）所有者本人のIssueについて、読み取り専用のエージェントが、
 * 選択肢・推奨案・ヒアリング事項・判断後の実装計画・事実と推測をまとめた資料を作り、Issueにコメントする。
 * 判断そのものは所有者が行う（自動で実装しない）。必須の見出しが欠けた資料は投稿しない。
 * 作成済みのIssueには `agent-briefed` を付ける（外すと再作成される）。
 *
 * 使い方:
 *   node decide.mjs --dry-run    対象と資料を表示するのみ（コメント・ラベルは変更しない）
 *   node decide.mjs              資料を作ってコメントする（最大 --max 件。既定2）
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 25）
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAILY_LIMITS, LABEL_BRIEFED, buildBriefPrompt, extractBrief, formatBriefComment, isBriefCandidate } from "./policy.js";
import { runAgent } from "./runner.mjs";
import { AUTH, BASE, LOG_DIR, REPO, SANDBOX, buildImage, dockerAvailable, dockerPhase, gh, loadState, log, run, saveState } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX_ISSUES = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 2;

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  /** @type {import("./policy.js").IssueSummary[]} */
  const issues = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--json", "number,title,body,author,labels", "--limit", "100"));
  const candidates = issues.filter(isBriefCandidate).slice(0, MAX_ISSUES);
  log(`意思決定資料の対象 ${candidates.length} 件（人手が必要・所有者起票・資料未作成。隔離: ${SANDBOX}）`);
  if (candidates.length === 0) return;
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
  if (!DRY_RUN) gh("label", "create", LABEL_BRIEFED, "--repo", REPO, "--color", "c5def5", "--description", "意思決定資料を自動作成済み（外すと再作成）", "--force");

  run("git", ["fetch", "origin", BASE]);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-triage-")), "tree");
  run("git", ["worktree", "add", "--detach", workDir, `origin/${BASE}`]);
  try {
    for (const issue of candidates) {
      if (loadState().costUsd >= DAILY_LIMITS.maxCostUsd) {
        log("中断: 本日の費用上限に達しました");
        break;
      }
      const prompt = buildBriefPrompt(issue);
      const auditName = `${new Date().toISOString().replace(/[:.]/g, "-")}-brief-issue-${issue.number}.jsonl`;
      mkdirSync(LOG_DIR, { recursive: true });
      const res = SANDBOX === "docker" ? dockerPhase("triage", workDir, auditName, prompt) : await runAgent(prompt, workDir, join(LOG_DIR, auditName), "triage");
      const s = loadState();
      saveState({ ...s, costUsd: s.costUsd + (res.cost ?? 0) });
      const brief = res.ok ? extractBrief(res.summary) : null;
      if (!brief) {
        log(`#${issue.number} 「${issue.title}」: 資料を作成できませんでした（実行失敗または必須の見出しが欠落）。今回は見送ります`);
        continue;
      }
      log(`#${issue.number} 「${issue.title}」: 意思決定資料を作成しました（${brief.length}文字）`);
      if (DRY_RUN) {
        console.log(brief);
        continue;
      }
      gh("issue", "comment", String(issue.number), "--repo", REPO, "--body", formatBriefComment(brief));
      gh("issue", "edit", String(issue.number), "--repo", REPO, "--add-label", LABEL_BRIEFED);
    }
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
