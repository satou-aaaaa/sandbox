#!/usr/bin/env node
/**
 * 1回分の自律運用サイクル（定期実行のエントリポイント）。
 *
 *   1. キルスイッチ確認 → 排他ロック取得（他の実行が進行中なら何もしない）
 *   2. 回復: 異常終了の残骸（agent-working のまま放置されたIssue・一時worktree）を片付ける
 *   3. スカウト（scout.mjs。作業の自動起票）→ トリアージ（triage.mjs）→ 実装とPR作成（run.mjs）
 *      → AIレビュー（review.mjs。承認が必要なPRを独立したレビュアーが判定）
 *   4. 結果を要約して標準出力と agent/logs/cycle-latest.txt に残す
 *
 * 各ステップは別プロセスで実行し、1つが失敗しても後始末（ロック解放・要約）は必ず行う。
 * マージは行わない（最終判断は常に人間）。
 *
 * 使い方:
 *   node cycle.mjs             1サイクル実行
 *   node cycle.mjs --dry-run   判定結果と対象の確認のみ（書き込みなし。回復も実行しない）
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 6）
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LABEL_NEEDS_HUMAN,
  LABEL_READY,
  LABEL_WORKING,
  TMP_STALE_MS,
  WORKING_STALE_MS,
  formatSummary,
  isStaleWorking,
  summarizeOutput,
} from "./policy.js";
import { acquireLock, releaseLock } from "./lock.mjs";
import { LOG_DIR, REPO, gh, log, run } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const LOCK_FILE = join(AGENT_DIR, ".state", "cycle.lock");
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const DRY_RUN = process.argv.includes("--dry-run");
const TMP_PREFIXES = ["kkt-agent-", "kkt-triage-", "kkt-task-"];

/**
 * 異常終了の残骸を片付ける。戻り値は回復したIssue数。
 * @returns {number}
 */
function recover() {
  let recovered = 0;
  const issues = JSON.parse(
    gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_WORKING, "--json", "number,labels,updatedAt", "--limit", "50"),
  );
  for (const issue of issues) {
    if (!isStaleWorking(issue, Date.now())) continue;
    gh("issue", "edit", String(issue.number), "--repo", REPO, "--remove-label", LABEL_WORKING, "--remove-label", LABEL_READY, "--add-label", LABEL_NEEDS_HUMAN);
    gh(
      "issue",
      "comment",
      String(issue.number),
      "--repo",
      REPO,
      "--body",
      `エージェントの処理が ${Math.round(WORKING_STALE_MS / 60000)} 分以上更新されず、異常終了の可能性があるため、自動処理を中止して「${LABEL_NEEDS_HUMAN}」に戻しました。状況を確認し、再度任せる場合は内容を整えてラベルを付け直してください。`,
    );
    log(`回復: #${issue.number} の処理中ラベルを解除しました`);
    recovered++;
  }
  // 登録済みの一時worktreeで古いものを外し、登録の残骸を掃除する
  try {
    const out = run("git", ["worktree", "list", "--porcelain"]);
    for (const line of out.split("\n")) {
      const m = line.match(/^worktree (.+)$/);
      if (!m) continue;
      const p = m[1];
      if (TMP_PREFIXES.some((pre) => p.includes(pre)) && existsSync(p) && Date.now() - statSync(p).mtimeMs > TMP_STALE_MS) {
        run("git", ["worktree", "remove", "--force", p]);
        log(`回復: 古い一時worktreeを削除しました: ${p}`);
      }
    }
    run("git", ["worktree", "prune"]);
  } catch {
    /* 掃除の失敗はサイクルを止めない */
  }
  // 一時ディレクトリの取り残しを削除する
  try {
    for (const name of readdirSync(tmpdir())) {
      if (!TMP_PREFIXES.some((pre) => name.startsWith(pre))) continue;
      const p = join(tmpdir(), name);
      if (Date.now() - statSync(p).mtimeMs > TMP_STALE_MS) rmSync(p, { recursive: true, force: true });
    }
  } catch {
    /* 同上 */
  }
  return recovered;
}

/**
 * 子スクリプトを実行し、出力を返す（表示もする）。
 * @param {string} script
 * @param {string[]} args
 * @returns {string}
 */
function runStep(script, args) {
  log(`--- ${script} ${args.join(" ")}`.trimEnd());
  const r = spawnSync(process.execPath, [join(AGENT_DIR, script), ...args], { cwd: AGENT_DIR, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(out);
  if (r.status !== 0) log(`${script} が終了コード ${r.status} で終了しました`);
  return out;
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (!acquireLock(LOCK_FILE)) {
    log("別のサイクルが進行中のため、今回はスキップします");
    return;
  }
  try {
    const started = new Date();
    let recovered = 0;
    if (!DRY_RUN) recovered = recover();
    const flag = DRY_RUN ? ["--dry-run"] : [];
    const out = runStep("scout.mjs", flag) + runStep("triage.mjs", flag) + runStep("run.mjs", flag) + runStep("review.mjs", flag);
    const summary = formatSummary(summarizeOutput(out), recovered);
    log(`サマリー: ${summary}`);
    mkdirSync(LOG_DIR, { recursive: true });
    const stamp = started.toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(LOG_DIR, `cycle-${stamp}.log`), `${summary}\n\n${out}`);
    writeFileSync(join(LOG_DIR, "cycle-latest.txt"), `${started.toISOString()}\n${summary}\n`);
  } finally {
    releaseLock(LOCK_FILE);
  }
}

await main();
