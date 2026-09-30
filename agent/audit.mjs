#!/usr/bin/env node
/**
 * セキュリティ点検（読み取り専用）。
 *
 * 読み取り専用のエージェントがリポジトリのセキュリティ上の懸念を調べ、根拠つきのIssueを起票する。
 * 起票されたIssueは agent-audit + agent-skip + agent-needs-human 付きで、自動実装・自動マージには乗らない（人が判断する）。
 * エージェントにはリポジトリ内のファイルだけを見せ、Issue・PRの本文は渡さない（プロンプトインジェクション対策）。
 *
 * 歯止め: 1回あたり最大2件、未完了の点検Issueが3件以上なら起票しない、既存Issueと重複しない、形式を満たさない報告は捨てる。
 *
 * 使い方:
 *   node audit.mjs --dry-run    報告を表示するのみ（起票しない）
 *   node audit.mjs              起票する
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 30）
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIT_ISSUE_LABELS, AUDIT_MAX_OPEN, DAILY_LIMITS, LABEL_AUDIT, buildAuditPrompt, parseAuditFindings, selectAuditFindings } from "./policy.js";
import { runAgent } from "./runner.mjs";
import { AUTH, BASE, LOG_DIR, REPO, SANDBOX, buildImage, dockerAvailable, dockerPhase, gh, loadState, log, run, saveState } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (loadState().costUsd >= DAILY_LIMITS.maxCostUsd) {
    log("本日の費用上限に達しているため、セキュリティ点検をスキップします");
    return;
  }
  const openAudit = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_AUDIT, "--json", "number", "--limit", "50")).length;
  if (openAudit >= AUDIT_MAX_OPEN) {
    log(`セキュリティ点検: 未完了の点検Issueが ${openAudit} 件あるため、新規の起票はしません（上限 ${AUDIT_MAX_OPEN}）`);
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
  // 重複判定にだけ使う。エージェントには渡さない
  const existingTitles = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "all", "--json", "title", "--limit", "300")).map((/** @type {{title: string}} */ i) => i.title);

  run("git", ["fetch", "origin", BASE]);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-audit-")), "tree");
  run("git", ["worktree", "add", "--detach", workDir, `origin/${BASE}`]);
  try {
    const prompt = buildAuditPrompt();
    const auditName = `${new Date().toISOString().replace(/[:.]/g, "-")}-audit.jsonl`;
    mkdirSync(LOG_DIR, { recursive: true });
    // 読み取り専用のフェーズ（triage: Read/Glob/Grepのみ・作業ツリーは読み取り専用）を使う
    const res = SANDBOX === "docker" ? dockerPhase("triage", workDir, auditName, prompt) : await runAgent(prompt, workDir, join(LOG_DIR, auditName), "triage");
    const s = loadState();
    saveState({ ...s, costUsd: s.costUsd + (res.cost ?? 0) });
    if (!res.ok) {
      log("セキュリティ点検: エージェントが正常終了しなかったため、起票しません");
      return;
    }
    const picked = selectAuditFindings(parseAuditFindings(res.summary), existingTitles, openAudit);
    log(`セキュリティ点検: 報告を ${picked.length} 件採用します（重複・上限・形式を除外後）`);
    if (picked.length > 0 && !DRY_RUN) {
      gh("label", "create", LABEL_AUDIT, "--repo", REPO, "--color", "d93f0b", "--description", "エージェントのセキュリティ点検が起票（人の判断が必要）", "--force");
    }
    for (const issue of picked) {
      if (DRY_RUN) {
        log(`  [dry-run] ${issue.title}`);
        continue;
      }
      const labels = AUDIT_ISSUE_LABELS.flatMap((l) => ["--label", l]);
      const url = gh("issue", "create", "--repo", REPO, "--title", issue.title, "--body", `${issue.body}\n\n---\n_エージェントのセキュリティ点検が起票しました（\`${LABEL_AUDIT}\`）。推測を含む可能性があるため、人が根拠を確認してから対応してください。_`, ...labels);
      log(`セキュリティ点検: 起票しました: ${url}`);
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
