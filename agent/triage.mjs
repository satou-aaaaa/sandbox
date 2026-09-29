#!/usr/bin/env node
/**
 * Issue の自動トリアージ（`agent-ready` を付けてよいかの判定）。
 *
 * 所有者本人が起票した未判定のIssueを、読み取り専用のエージェントに評価させ、
 * 決定的なルール（policy.js の decideTriage）で次のいずれかにする:
 *   - 実行してよい → `agent-triaged` + `agent-ready`（次の run.mjs が実装に着手する）
 *   - 人手が必要   → `agent-triaged` + `agent-needs-human` + 理由コメント
 * 判定を解釈できない場合は必ず「人手が必要」側に倒す（フェイルクローズ）。
 * 第三者が起票したIssueは一切対象にしない（プロンプトインジェクション対策）。
 *
 * 人による上書き: `agent-skip` を付けると永久に対象外。`agent-triaged` を外すと再判定される。
 *
 * 使い方:
 *   node triage.mjs --dry-run    判定結果を表示するのみ（ラベル・コメントは変更しない）
 *   node triage.mjs              判定してラベルを付ける（最大 --max 件。既定5）
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 4）
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DAILY_LIMITS,
  LABEL_NEEDS_HUMAN,
  LABEL_READY,
  LABEL_TRIAGED,
  buildTriagePrompt,
  decideTriage,
  isTriageCandidate,
  parseTriageVerdict,
} from "./policy.js";
import { runAgent } from "./runner.mjs";
import { AUTH, BASE, LOG_DIR, REPO, SANDBOX, buildImage, dockerAvailable, dockerPhase, gh, loadState, log, run, saveState } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const MAX_ISSUES = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 5;

function ensureLabels() {
  const labels = [
    [LABEL_TRIAGED, "ededed", "エージェントの自動トリアージ済み（外すと再判定）"],
    [LABEL_NEEDS_HUMAN, "d93f0b", "自動トリアージの結果、人手での確認が必要"],
    [LABEL_READY, "0e8a16", "エージェントが着手してよいIssue"],
  ];
  for (const [name, color, description] of labels) {
    gh("label", "create", name, "--repo", REPO, "--color", color, "--description", description, "--force");
  }
}

/** @returns {import("./policy.js").IssueSummary[]} */
function fetchCandidates() {
  const json = gh("issue", "list", "--repo", REPO, "--state", "open", "--json", "number,title,body,author,labels", "--limit", "100");
  /** @type {import("./policy.js").IssueSummary[]} */
  const issues = JSON.parse(json);
  return issues.filter(isTriageCandidate).slice(0, MAX_ISSUES);
}

/**
 * 1件を評価する。評価に失敗（実行エラー等）した場合は null を返す（＝人手に回す）。
 * @param {import("./policy.js").IssueSummary} issue
 * @param {string} workDir 読み取り専用で評価する作業ツリー
 * @returns {Promise<{verdict: import("./policy.js").TriageVerdict | null, cost: number}>}
 */
async function evaluate(issue, workDir) {
  const prompt = buildTriagePrompt(issue);
  const auditName = `${new Date().toISOString().replace(/[:.]/g, "-")}-triage-issue-${issue.number}.jsonl`;
  mkdirSync(LOG_DIR, { recursive: true });
  const res = SANDBOX === "docker" ? dockerPhase("triage", workDir, auditName, prompt) : await runAgent(prompt, workDir, join(LOG_DIR, auditName), "triage");
  return { verdict: res.ok ? parseTriageVerdict(res.summary) : null, cost: res.cost ?? 0 };
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  const candidates = fetchCandidates();
  log(`トリアージ対象 ${candidates.length} 件（起票者が所有者本人・未判定のもの。隔離: ${SANDBOX}）`);
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
  if (!DRY_RUN) ensureLabels();

  // 評価は全件で1つの読み取り専用worktree（origin/main）を共有する
  run("git", ["fetch", "origin", BASE]);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-triage-")), "tree");
  run("git", ["worktree", "add", "--detach", workDir, `origin/${BASE}`]);
  try {
    for (const issue of candidates) {
      if (loadState().costUsd >= DAILY_LIMITS.maxCostUsd) {
        log("中断: 本日の費用上限に達しました");
        break;
      }
      const { verdict, cost } = await evaluate(issue, workDir);
      const s = loadState();
      saveState({ ...s, costUsd: s.costUsd + cost });
      const decision = decideTriage(verdict);
      log(`#${issue.number} 「${issue.title}」→ ${decision.ready ? "ready（実行してよい）" : "needs-human（人手が必要）"}: ${decision.reason}`);
      if (DRY_RUN) continue;
      const add = decision.ready ? [LABEL_TRIAGED, LABEL_READY] : [LABEL_TRIAGED, LABEL_NEEDS_HUMAN];
      gh("issue", "edit", String(issue.number), "--repo", REPO, ...add.flatMap((l) => ["--add-label", l]));
      const body = decision.ready
        ? `自動トリアージ: エージェントによる実装に回します（\`${LABEL_READY}\`）。\n\n> ${decision.reason}\n\nPRは必ず人手レビュー・マージです。除外する場合は \`agent-skip\` を付けてください。`
        : `自動トリアージ: 人手での対応が必要と判断しました（\`${LABEL_NEEDS_HUMAN}\`）。\n\n> ${decision.reason}\n\n自動で実装させたい場合は、内容を具体化したうえで \`${LABEL_TRIAGED}\` と \`${LABEL_NEEDS_HUMAN}\` を外してください（再判定されます）。`;
      gh("issue", "comment", String(issue.number), "--repo", REPO, "--body", body);
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
