#!/usr/bin/env node
/**
 * 自動の点検（セルフテスト）。エージェント運用のパイプライン全体を、ダミーのIssueで実際に通し、回帰を検知する。
 *
 *   1. 起票      ダミーIssue（事前にトリアージ済み）を作る
 *   2. 実装      run.mjs でPRを作る → 自動マージされるのを待つ → 専用ファイル docs/SELFTEST.md に目印の行が入ったことを検証
 *   3. 完了同期  sync.mjs でIssueがクローズされることを検証
 *   4. 取消      revert.mjs でPRを取り消す → 目印の行が消え、Issueが再オープンされて再挑戦の状態になることを検証
 *   5. 再挑戦    run.mjs で再実装 → 自動マージ → 目印の行が戻り、Issueがクローズされることを検証
 *
 * 失敗したら、障害Issue（agent-incident）を1件だけ立てる（重複しない）。触るのは docs/SELFTEST.md だけ
 * （記録として、成功のたびに1行残る）。トリアージのLLM判定は非決定的で誤検知になるため、点検の対象外。
 *
 * 使い方:
 *   node selftest.mjs --dry-run    実施内容を表示するのみ
 *   node selftest.mjs --if-due     前回から間隔（7日）を超えている場合だけ実施（cycle.mjs から呼ぶ）
 *   node selftest.mjs              実施する
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 15）
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DAILY_LIMITS,
  LABEL_INCIDENT,
  LABEL_NEEDS_HUMAN,
  LABEL_READY,
  LABEL_SELFTEST,
  LABEL_TRIAGED,
  SELFTEST_FILE,
  SELFTEST_INTERVAL_DAYS,
  buildSelftestIssue,
  hasSelftestLine,
  isSelftestDue,
} from "./policy.js";
import { BASE, REPO, gh, loadState, log, run } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const STATE_FILE = join(AGENT_DIR, ".state", "selftest.json");
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const IF_DUE = args.includes("--if-due");
/** PRのマージ（CI＋自動マージ）を待つ上限。 */
const MERGE_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_MS = 30 * 1000;

/** 点検には実装が2回（初回と再挑戦）必要。日次の上限の残りがこれ未満なら、開始しない。 */
const RUNS_NEEDED = 2;
/** 失敗した場合は、翌日に再点検する（次回までの間隔を1日にする）。 */
const RETRY_AFTER_FAILURE_DAYS = 1;

/** 日次の上限などで、点検を「見送る」べき状況（失敗ではない）。 */
class Deferred extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

/** 条件が満たされるまで待つ。上限を超えたら例外。 */
async function waitFor(description, check, timeoutMs, intervalMs = POLL_MS) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`タイムアウト: ${description}`);
    await sleep(intervalMs);
  }
}

/** 子スクリプトを実行し、出力を返す。 */
function runChild(script, childArgs) {
  const r = spawnSync(process.execPath, [join(AGENT_DIR, script), ...childArgs], { cwd: AGENT_DIR, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  // 日次の上限による中断は、点検の失敗ではなく「見送り」（パイプラインの不具合ではない）
  if (out.includes("本日の実行回数上限") || out.includes("本日の費用上限")) throw new Deferred("日次の上限に達したため、点検を見送ります");
  if (r.status !== 0) throw new Error(`${script} が終了コード ${r.status} で終了しました: ${out.split("\n").filter(Boolean).slice(-3).join(" / ")}`);
  return out;
}

/** 出力から「PRを作成しました: URL」のPR番号を取り出す。 */
function prNumberFromOutput(out) {
  const key = "PRを作成しました: ";
  const line = out.split("\n").find((l) => l.includes(key));
  if (!line) {
    // 原因（giveBackの理由等）は run.mjs の出力にしか残らないため、
    // 末尾を障害報告に含めて、ホストのログを見なくても診断できるようにする。
    const tail = out.split("\n").filter(Boolean).slice(-15).join("\n");
    throw new Error(`PRが作成されませんでした（run.mjs の出力に PR作成の記録がありません）\n\nrun.mjs の出力（末尾）:\n${tail}`);
  }
  const url = line.slice(line.indexOf(key) + key.length).trim();
  const n = url.slice(url.lastIndexOf("/") + 1);
  if (!(n.length > 0 && [...n].every((c) => c >= "0" && c <= "9"))) throw new Error(`PR番号を解釈できません: ${url}`);
  return Number(n);
}

const prState = (n) => gh("pr", "view", String(n), "--repo", REPO, "--json", "state", "--jq", ".state");
const issueState = (n) => gh("issue", "view", String(n), "--repo", REPO, "--json", "state", "--jq", ".state");

async function waitMerged(prNumber) {
  await waitFor(`PR #${prNumber} のマージ`, () => {
    const s = prState(prNumber);
    if (s === "CLOSED") throw new Error(`PR #${prNumber} がマージされずに閉じられました`);
    return s === "MERGED";
  }, MERGE_TIMEOUT_MS);
}

function mainHasLine(marker) {
  run("git", ["fetch", "origin", BASE]);
  return hasSelftestLine(run("git", ["show", `origin/${BASE}:${SELFTEST_FILE}`]), marker);
}

/** 点検用のIssueを片付ける（閉じて、実行対象から外す）。 */
function cleanupIssue(issueNumber, comment) {
  try {
    gh("issue", "close", String(issueNumber), "--repo", REPO, "--reason", "not planned", "--comment", comment);
    gh("issue", "edit", String(issueNumber), "--repo", REPO, "--remove-label", LABEL_READY, "--add-label", "agent-skip");
  } catch (e) {
    log(`点検: Issueの片付けに失敗しました: ${e instanceof Error ? e.message.split(String.fromCharCode(10))[0] : String(e)}`);
  }
}

/** 失敗を障害Issueとして記録する（重複しない）。点検用のIssueは片付ける。 */
function reportFailure(stage, err, issueNumber) {
  const message = err instanceof Error ? err.message : String(err);
  log(`点検: 失敗（${stage}）: ${message}`);
  try {
    if (issueNumber) {
      gh("issue", "close", String(issueNumber), "--repo", REPO, "--reason", "not planned", "--comment", `点検が「${stage}」で失敗したため、この点検用Issueを閉じます。`);
      gh("issue", "edit", String(issueNumber), "--repo", REPO, "--remove-label", LABEL_READY, "--add-label", "agent-skip");
    }
    const open = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_INCIDENT, "--json", "number,title", "--limit", "20")).filter((i) => i.title.startsWith("incident: 自動点検"));
    if (open.length === 0) {
      gh("label", "create", LABEL_INCIDENT, "--repo", REPO, "--color", "b60205", "--description", "エージェントの自動運用の障害記録", "--force");
      gh("issue", "create", "--repo", REPO, "--title", "incident: 自動点検（セルフテスト）が失敗しました", "--label", LABEL_INCIDENT, "--label", LABEL_NEEDS_HUMAN, "--body", [`自動点検が「${stage}」で失敗しました。`, "", `エラー: ${message}`, "", "エージェント運用のパイプラインに回帰がある可能性があります。原因を確認してください（agent/logs/ のログ、agent-selftest ラベルのIssue/PRを参照）。解消したら、このIssueをクローズしてください。"].join("\n"));
    }
  } catch (e) {
    log(`点検: 障害の記録に失敗しました: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (IF_DUE && !isSelftestDue(readState().lastRun, Date.now())) {
    log("点検: 前回から間隔が空いていないため、今回は実施しません");
    return;
  }
  const remaining = DAILY_LIMITS.maxRuns - loadState().runs;
  if (remaining < RUNS_NEEDED && !DRY_RUN) {
    log(`点検: 日次の実装回数の残りが ${remaining} 回（必要 ${RUNS_NEEDED} 回）のため、今回は見送ります（次のサイクルで再度判定します）`);
    return;
  }
  const marker = new Date().toISOString();
  const { title, body } = buildSelftestIssue(marker);
  if (DRY_RUN) {
    log(`[dry-run] 点検を実施します。起票: 「${title}」 → 実装 → 自動マージ → 完了同期 → 取消 → 再挑戦（触るのは ${SELFTEST_FILE} のみ）`);
    return;
  }
  log(`点検: 開始（${marker}）`);
  let issueNumber = null;
  let stage = "起票";
  try {
    gh("label", "create", LABEL_SELFTEST, "--repo", REPO, "--color", "c5def5", "--description", "エージェント運用の自動点検（セルフテスト）", "--force");
    const url = gh("issue", "create", "--repo", REPO, "--title", title, "--body", body, "--label", LABEL_SELFTEST, "--label", LABEL_TRIAGED, "--label", LABEL_READY);
    issueNumber = Number(url.slice(url.lastIndexOf("/") + 1));

    stage = "実装（run.mjs）";
    const pr1 = prNumberFromOutput(runChild("run.mjs", ["--issue", String(issueNumber), "--max", "1"]));
    stage = `自動マージ（PR #${pr1}）`;
    await waitMerged(pr1);
    stage = "マージ後の内容の検証";
    if (!mainHasLine(marker)) throw new Error("マージされたのに、mainに目印の行がありません");

    stage = "完了同期（sync.mjs）";
    runChild("sync.mjs", []);
    if (issueState(issueNumber) !== "CLOSED") throw new Error("PRがマージされたのに、Issueがクローズされませんでした");

    stage = `取消（PR #${pr1}）`;
    runChild("revert.mjs", ["--pr", String(pr1), "--reason", "自動点検（セルフテスト）: 取消の動作確認", "--selftest"]);
    const reverts = JSON.parse(gh("pr", "list", "--repo", REPO, "--label", LABEL_SELFTEST, "--state", "all", "--json", "number,title", "--limit", "20")).filter((p) => p.title.includes(`(#${pr1})`) && p.title.startsWith("revert:"));
    if (reverts.length === 0) throw new Error("リバートPRが作成されませんでした");
    stage = `取消の自動マージ（PR #${reverts[0].number}）`;
    await waitMerged(reverts[0].number);
    if (mainHasLine(marker)) throw new Error("取り消したのに、mainに目印の行が残っています");
    stage = "取消後のIssueの状態";
    const labels = JSON.parse(gh("issue", "view", String(issueNumber), "--repo", REPO, "--json", "state,labels")).labels.map((l) => l.name);
    if (issueState(issueNumber) !== "OPEN" || !labels.includes(LABEL_READY) || !labels.some((l) => l.startsWith("agent-retry-"))) {
      throw new Error(`取消後のIssueが再挑戦の状態になっていません（ラベル: ${labels.join(",")}）`);
    }

    stage = "再挑戦（run.mjs）";
    const pr2 = prNumberFromOutput(runChild("run.mjs", ["--issue", String(issueNumber), "--max", "1"]));
    stage = `再挑戦の自動マージ（PR #${pr2}）`;
    await waitMerged(pr2);
    stage = "再挑戦後の内容の検証";
    if (!mainHasLine(marker)) throw new Error("再挑戦のPRがマージされたのに、mainに目印の行がありません");
    stage = "再挑戦後の完了同期";
    runChild("sync.mjs", []);
    if (issueState(issueNumber) !== "CLOSED") throw new Error("再挑戦のPRがマージされたのに、Issueがクローズされませんでした");

    writeState({ lastRun: marker, ok: true });
    log("点検: 成功（起票・実装・自動マージ・完了同期・取消・再挑戦のすべてを確認）");
  } catch (err) {
    if (err instanceof Deferred) {
      // 失敗ではなく見送り: 記録は更新せず（次のサイクルで再度点検する）、点検用のIssueだけ片付ける。障害Issueは立てない
      log(`点検: 見送り（${stage}）: ${err.message}`);
      if (issueNumber) cleanupIssue(issueNumber, "日次の上限のため、この点検用Issueを閉じます（次回に再度点検します）。");
      return;
    }
    // 失敗は、翌日に再点検する（lastRun を「間隔の手前」にずらす）
    const retryAt = new Date(Date.now() - (SELFTEST_INTERVAL_DAYS - RETRY_AFTER_FAILURE_DAYS) * 24 * 60 * 60 * 1000).toISOString();
    writeState({ lastRun: retryAt, ok: false, stage, failedAt: marker });
    reportFailure(stage, err, issueNumber);
    process.exitCode = 0; // 点検の失敗はcycle全体の失敗にしない（障害Issueで知らせる）
  }
}

await main();
