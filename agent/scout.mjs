#!/usr/bin/env node
/**
 * 作業の自動起票（スカウト）。
 *
 * 読み取り専用のエージェントがリポジトリを調べ、「自動マージできる低リスクな作業」
 * （テストの追加、README/CHANGELOGの食い違い修正）を、小さく具体的なIssueとして起票する。
 * 起票されたIssueは agent-scouted ラベル付きで、通常どおりトリアージ→実装→PR→自動マージの流れに乗る。
 *
 * 歯止め: 1回あたり最大2件、未完了のスカウトIssueが5件以上なら起票しない、既存Issueと重複しない、
 * 法令判定・期限計算・src/実装・保護パスに関わる提案は対象外（policy.js）。
 *
 * 使い方:
 *   node scout.mjs --dry-run    提案を表示するのみ（起票しない）
 *   node scout.mjs              起票する
 *   --focus tests|docs|all      観点を指定する（省略時は日付で tests / docs を交互に回す。Amendment 29）
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 8）
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAILY_LIMITS, LABEL_SCOUTED, SCOUT_MAX_OPEN, buildScoutPrompt, parseScoutIssues, pickScoutFocus, selectScoutIssues } from "./policy.js";
import { runAgent } from "./runner.mjs";
import { AUTH, BASE, LOG_DIR, REPO, SANDBOX, buildImage, dockerAvailable, dockerPhase, gh, loadState, log, run, saveState } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const DRY_RUN = process.argv.includes("--dry-run");
const focusIdx = process.argv.indexOf("--focus");
const FOCUS = pickScoutFocus(focusIdx >= 0 ? process.argv[focusIdx + 1] : undefined);

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (loadState().costUsd >= DAILY_LIMITS.maxCostUsd) {
    log("本日の費用上限に達しているため、スカウトをスキップします");
    return;
  }
  const openScouted = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_SCOUTED, "--json", "number", "--limit", "50")).length;
  if (openScouted >= SCOUT_MAX_OPEN) {
    log(`スカウト: 未完了の起票済みIssueが ${openScouted} 件あるため、新規の起票はしません（上限 ${SCOUT_MAX_OPEN}）`);
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
  const existingTitles = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "all", "--json", "title", "--limit", "300")).map((/** @type {{title: string}} */ i) => i.title);

  run("git", ["fetch", "origin", BASE]);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-triage-")), "tree");
  run("git", ["worktree", "add", "--detach", workDir, `origin/${BASE}`]);
  try {
    const prompt = buildScoutPrompt(existingTitles, FOCUS);
    log(`スカウト: 観点=${FOCUS}`);
    const auditName = `${new Date().toISOString().replace(/[:.]/g, "-")}-scout.jsonl`;
    mkdirSync(LOG_DIR, { recursive: true });
    // 読み取り専用の評価と同じフェーズ（triage）を使う（Read/Glob/Grepのみ・作業ツリーは読み取り専用）
    const res = SANDBOX === "docker" ? dockerPhase("triage", workDir, auditName, prompt) : await runAgent(prompt, workDir, join(LOG_DIR, auditName), "triage");
    const s = loadState();
    saveState({ ...s, costUsd: s.costUsd + (res.cost ?? 0) });
    if (!res.ok) {
      log("スカウト: エージェントが正常終了しなかったため、起票しません");
      return;
    }
    const picked = selectScoutIssues(parseScoutIssues(res.summary), existingTitles, openScouted);
    log(`スカウト: 提案を ${picked.length} 件採用します（重複・上限・形式を除外後）`);
    if (picked.length > 0 && !DRY_RUN) {
      gh("label", "create", LABEL_SCOUTED, "--repo", REPO, "--color", "c5def5", "--description", "エージェントが起票した作業（自動マージ可能な低リスク作業に限定）", "--force");
    }
    for (const issue of picked) {
      if (DRY_RUN) {
        log(`  [dry-run] ${issue.title}`);
        continue;
      }
      const url = gh("issue", "create", "--repo", REPO, "--title", issue.title, "--body", `${issue.body}\n\n---\n_エージェントのスカウトが起票しました（\`${LABEL_SCOUTED}\`）。_`, "--label", LABEL_SCOUTED);
      log(`スカウト: 起票しました: ${url}`);
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
