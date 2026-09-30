#!/usr/bin/env node
/**
 * 1回分の自律運用サイクル（定期実行のエントリポイント）。
 *
 *   1. キルスイッチ確認 → 排他ロック取得（他の実行が進行中なら何もしない）
 *   2. 回復: 異常終了の残骸（agent-working のまま放置されたIssue・一時worktree）を片付ける
 *   3. スカウト（scout.mjs。作業の自動起票）→ トリアージ（triage.mjs）→ 実装とPR作成（run.mjs）
 *      → 自己修復（fix.mjs。CI失敗・レビュー指摘のPRを修正）→ AIレビュー（review.mjs。承認が必要なPRを独立したレビュアーが判定）
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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  USAGE_BACKOFF_MS,
  detectUsageLimit,
  isBackedOff,
  LABEL_INCIDENT,
  LABEL_NEEDS_HUMAN,
  LABEL_REVERT_PR,
  LABEL_READY,
  LABEL_WORKING,
  TMP_STALE_MS,
  WORKING_STALE_MS,
  formatSummary,
  isStaleWorking,
  shouldTripBreaker,
  summarizeOutput,
} from "./policy.js";
import { acquireLock, releaseLock } from "./lock.mjs";
import { LOG_DIR, REPO, gh, log, run } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const LOCK_FILE = join(AGENT_DIR, ".state", "cycle.lock");
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const BACKOFF_FILE = join(AGENT_DIR, ".state", "backoff.json");
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
 * サーキットブレーカー: 直近24時間に自動リバートが続いていれば、自動運用を止める（同じ失敗を繰り返さない）。
 * 止めた場合は、障害の記録用Issueを1件だけ立てて人手に知らせる。
 * @returns {boolean} 止めるべきなら true
 */
function breakerTripped() {
  const prs = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "all", "--label", LABEL_REVERT_PR, "--json", "createdAt", "--limit", "20"));
  if (!shouldTripBreaker(prs.map((p) => p.createdAt), Date.now())) return false;
  log("サーキットブレーカー: 直近24時間に自動リバートが続いたため、今回の自動運用を停止します");
  if (!DRY_RUN) {
    const open = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_INCIDENT, "--json", "number", "--limit", "1"));
    if (open.length === 0) {
      gh("label", "create", LABEL_INCIDENT, "--repo", REPO, "--color", "b60205", "--description", "エージェントの自動運用の障害記録", "--force");
      gh("issue", "create", "--repo", REPO, "--title", "incident: 自動リバートが続いたため、エージェントの自動運用を停止しました", "--label", LABEL_INCIDENT, "--label", LABEL_NEEDS_HUMAN, "--body", ["直近24時間に、エージェントのPRの自動リバートが複数回発生したため、自動運用（スカウト・トリアージ・実装・レビュー）を停止しました。", "", "原因を確認し、解消したら、このIssueをクローズしてください（クローズ後、次のサイクルから再開します）。リバートPR（agent-revert-pr）と、取り消されたPRの理由を確認してください。"].join("\n"));
    }
  }
  return true;
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

/** 利用枠の逼迫による見送り期間中か（前回のサイクルが上限を検知して保存した状態）。 */
function backedOff() {
  try {
    return isBackedOff(JSON.parse(readFileSync(BACKOFF_FILE, "utf8")), Date.now());
  } catch {
    return false; // 状態が無い・壊れている場合は、見送らない
  }
}

/** 利用枠の上限を検知したので、一定時間、重い処理を見送る状態を保存する。 */
function startBackoff() {
  try {
    mkdirSync(dirname(BACKOFF_FILE), { recursive: true });
    writeFileSync(BACKOFF_FILE, JSON.stringify({ until: Date.now() + USAGE_BACKOFF_MS }));
  } catch {
    /* 保存できなくても、このサイクルの見送りは行う */
  }
}

/** リモートの一時停止: 開いているIssueに agent-pause ラベルが付いていれば、自動運用を止める（スマホから停止・再開できる）。 */
function remotePaused() {
  try {
    return JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", "agent-pause", "--json", "number", "--limit", "1")).length > 0;
  } catch {
    return false; // 確認できなくても、運用は止めない（停止は明示の操作で行う）
  }
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (remotePaused()) {
    log("リモートの一時停止が有効です（agent-pause ラベルの付いた開いているIssueがあります）。何もせず終了します");
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
    // 1. 事後の取消: 問題のあるマージを取り消す（所有者のラベル、またはmainのCI失敗）
    // 0. Issueの完了同期（自動マージでは、キーワードによる自動クローズやclosedイベントのworkflowが働かないため）
    let out = runStep("sync.mjs", flag);
    out += runStep("revert.mjs", ["--sweep", ...flag]);
    // 2. ブレーカーが作動していなければ、通常の流れ（スカウト→トリアージ→実装→レビュー）を実行する
    let throttled = false;
    if (!breakerTripped()) {
      if (backedOff()) {
        throttled = true;
        log("利用枠の逼迫による見送り期間中のため、重い処理（スカウト・トリアージ・実装・修復・レビュー）を見送ります");
      } else {
        // 利用枠の上限を検知したら、残りの重い処理を見送る（対話利用への支障を避ける）。次回以降は時間が過ぎれば自動で再開する
        for (const script of ["scout.mjs", "triage.mjs", "run.mjs", "fix.mjs", "review.mjs"]) {
          const stepOut = runStep(script, flag);
          out += stepOut;
          if (detectUsageLimit(stepOut)) {
            throttled = true;
            log("利用枠の上限を検知したため、残りの重い処理を見送ります");
            if (!DRY_RUN) startBackoff();
            break;
          }
        }
      }
      // 3. 週1回、パイプライン全体を通す自動の点検（回帰の検知。--if-due で、間隔が空いた場合だけ実施）
      if (!DRY_RUN) out += runStep("selftest.mjs", ["--if-due"]);
    }
    // 4. 運用レポート（GitHubの状態から決定的に集計。日次は動き・問題がある日だけ投稿、週次は7日ごと）
    if (!DRY_RUN) out += runStep("report.mjs", ["--post"]) + runStep("report.mjs", ["--if-weekly-due", "--post"]);
    const summary = formatSummary(summarizeOutput(out), recovered, throttled);
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
