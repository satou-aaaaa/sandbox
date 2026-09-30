#!/usr/bin/env node
/**
 * 運用レポート（日次・週次の報告）。自律運用の結果を、GitHubの状態（PR・Issue・ラベル）から決定的に集計して届ける。
 * LLMは使わない（費用がかからず、誤りも混入しない）。問題がある日は目立たせ、何も起きなかった日は静かにする。
 *
 * 届け方:
 *   - 標準出力と agent/logs/report-latest.md（スケジュールタスクの完了通知に載せられる）
 *   - --post 指定時: 常設のレポート用Issue（agent-report）へコメント（日次は、動きがある/問題がある日だけ。週次は常に）
 *
 * 使い方:
 *   node report.mjs                       日次（直近1日）を表示するのみ
 *   node report.mjs --period weekly       週次（直近7日）を表示するのみ
 *   node report.mjs --post                投稿もする（投稿の要否は shouldPostReport で決まる）
 *   node report.mjs --if-weekly-due --post  前回の週次から7日以上たっている場合だけ、週次を投稿する（cycle.mjs から呼ぶ）
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 16）
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LABEL_INCIDENT,
  LABEL_NEEDS_HUMAN,
  LABEL_REPORT,
  LABEL_REVERT_PR,
  buildReport,
  pickMajorUpdates,
  pickStalePrs,
  isSelftestDue,
  shouldPostReport,
  shouldTripBreaker,
  summarizeChecks,
} from "./policy.js";
import { LOG_DIR, REPO, gh, log } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const STATE_DIR = join(AGENT_DIR, ".state");
const HISTORY_FILE = join(STATE_DIR, "cost-history.jsonl");
const REPORT_STATE_FILE = join(STATE_DIR, "report.json");
const args = process.argv.slice(2);
const POST = args.includes("--post");
const IF_WEEKLY_DUE = args.includes("--if-weekly-due");
const PERIOD = IF_WEEKLY_DUE || (args.includes("--period") && args[args.indexOf("--period") + 1] === "weekly") ? "weekly" : "daily";
const DAYS = PERIOD === "weekly" ? 7 : 1;
const REPORT_ISSUE_TITLE = "agent: 運用レポート（自動投稿）";

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** 本日分の費用を履歴に記録し、直近N日の合計（推定）を返す。記録が無ければ null。 */
function costForPeriod(days) {
  mkdirSync(STATE_DIR, { recursive: true });
  const daily = readJson(join(STATE_DIR, "daily.json"), null);
  const byDate = new Map();
  if (existsSync(HISTORY_FILE)) {
    for (const line of readFileSync(HISTORY_FILE, "utf8").split("\n")) {
      try {
        const e = JSON.parse(line);
        byDate.set(e.date, e.costUsd);
      } catch {
        /* 壊れた行は無視する */
      }
    }
  }
  if (daily && typeof daily.date === "string" && Number.isFinite(daily.costUsd)) {
    if (byDate.get(daily.date) !== daily.costUsd) appendFileSync(HISTORY_FILE, `${JSON.stringify({ date: daily.date, costUsd: daily.costUsd })}\n`);
    byDate.set(daily.date, daily.costUsd);
  }
  if (byDate.size === 0) return null;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  let total = 0;
  let any = false;
  for (const [date, cost] of byDate) {
    const t = Date.parse(`${date}T12:00:00`);
    if (Number.isFinite(t) && t >= since - 12 * 60 * 60 * 1000) {
      total += cost;
      any = true;
    }
  }
  return any ? total : null;
}

/** @returns {import("./policy.js").ReportData} */
function collect() {
  const since = Date.now() - DAYS * 24 * 60 * 60 * 1000;
  const merged = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "merged", "--json", "number,title,headRefName,mergedAt,mergedBy,labels", "--limit", "100"))
    .filter((p) => Date.parse(p.mergedAt) >= since);
  const isSelftest = (p) => p.title.includes("selftest:") || p.labels.some((l) => l.name === "agent-selftest");
  const agent = merged.filter((p) => p.headRefName.startsWith("agent/issue-") && !isSelftest(p));
  const reverts = merged.filter((p) => p.headRefName.startsWith("revert/pr-") && !isSelftest(p));
  const dependabot = merged.filter((p) => p.headRefName.startsWith("dependabot/"));
  const human = merged.filter((p) => !p.headRefName.startsWith("agent/issue-") && !p.headRefName.startsWith("revert/pr-") && !p.headRefName.startsWith("dependabot/"));
  const openPrs = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "open", "--json", "number,title,headRefName,labels,statusCheckRollup,createdAt,isDraft", "--limit", "50"));
  const labelNames = (p) => p.labels.map((l) => l.name);
  const issues = (label) => JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", label, "--json", "number,title", "--limit", "30"));
  const revertPrs = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "all", "--label", LABEL_REVERT_PR, "--json", "createdAt", "--limit", "20"));
  const selftest = readJson(join(STATE_DIR, "selftest.json"), null);
  return {
    periodLabel: PERIOD === "weekly" ? "直近7日" : "直近24時間",
    agentMerged: agent.length,
    // 自動マージは GitHub の bot（github-actions）がマージ者になる
    autoMerged: agent.filter((p) => p.mergedBy?.login === "github-actions" || p.mergedBy?.is_bot === true).length,
    reverted: reverts.length,
    humanMerged: human.length,
    dependabotMerged: dependabot.length,
    aiApproved: agent.filter((p) => labelNames(p).includes("agent-approved") && labelNames(p).includes("agent-ai-reviewed")).length,
    aiRejected: openPrs.filter((p) => labelNames(p).includes("agent-changes-requested")).length,
    needsHuman: issues(LABEL_NEEDS_HUMAN),
    incidents: issues(LABEL_INCIDENT),
    needsReview: openPrs.filter((p) => labelNames(p).includes("agent-needs-review") && !labelNames(p).includes("agent-approved")).map((p) => ({ number: p.number, title: p.title })),
    failing: openPrs.filter((p) => p.headRefName.startsWith("agent/issue-") && summarizeChecks(p.statusCheckRollup) === "failed").map((p) => ({ number: p.number, title: p.title })),
    costUsd: costForPeriod(DAYS),
    selftest,
    breaker: shouldTripBreaker(revertPrs.map((p) => p.createdAt), Date.now()),
    stalePrs: pickStalePrs(openPrs, Date.now()),
    majorUpdates: pickMajorUpdates(openPrs),
  };
}

/** 常設のレポート用Issueの番号（無ければ作る）。 */
function reportIssueNumber() {
  const found = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_REPORT, "--json", "number", "--limit", "1"));
  if (found.length > 0) return found[0].number;
  gh("label", "create", LABEL_REPORT, "--repo", REPO, "--color", "0e8a16", "--description", "運用レポートの常設Issue", "--force");
  gh("label", "create", "agent-skip", "--repo", REPO, "--color", "ededed", "--description", "自動トリアージ・実装の対象外（人が外すまで）", "--force");
  const url = gh("issue", "create", "--repo", REPO, "--title", REPORT_ISSUE_TITLE, "--label", LABEL_REPORT, "--label", "agent-skip", "--body", "エージェントの運用レポートが、コメントとして自動投稿されます（agent/report.mjs）。通知を受け取るには、このIssueをWatch（購読）してください。人手の操作は不要です。");
  return Number(url.slice(url.lastIndexOf("/") + 1));
}

function main() {
  const state = readJson(REPORT_STATE_FILE, {});
  if (IF_WEEKLY_DUE && !isSelftestDue(state.lastWeekly, Date.now(), 7)) {
    log("レポート: 前回の週次から間隔が空いていないため、今回は作成しません");
    return;
  }
  const data = collect();
  const report = buildReport(data);
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(join(LOG_DIR, "report-latest.md"), `${report}\n`);
  console.log(report);
  if (!POST) return;
  if (!shouldPostReport(PERIOD, data)) {
    log("レポート: 動きも問題も無いため、投稿しません");
    return;
  }
  const n = reportIssueNumber();
  gh("issue", "comment", String(n), "--repo", REPO, "--body", report);
  if (PERIOD === "weekly") writeFileSync(REPORT_STATE_FILE, JSON.stringify({ ...state, lastWeekly: new Date().toISOString() }));
  log(`レポート: Issue #${n} に投稿しました`);
}

main();
