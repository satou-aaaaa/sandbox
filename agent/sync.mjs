#!/usr/bin/env node
/**
 * Issueの完了同期。エージェントのPRがマージされたのに開いたままのIssueを、状態から判断してクローズする。
 *
 * 自動マージ（GITHUB_TOKEN）でマージされたPRは、`Closes #N` による自動クローズも、PRのclosedイベントを
 * 契機とするworkflow（agent-issue-sync）も働かない（GitHubの仕様）。cycle.mjs の先頭でこの点検を行い、取りこぼしを防ぐ。
 * 取り消し済み（agent-reverted）のPRは、完了とみなさない。
 *
 * 使い方: node sync.mjs [--dry-run]
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 14）
 */
import { LABEL_DONE, LABEL_NEEDS_HUMAN, LABEL_READY, LABEL_WORKING, shouldCloseAsCompleted } from "./policy.js";
import { REPO, gh, log } from "./run.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

const issues = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_DONE, "--json", "number,labels", "--limit", "50"));
let closed = 0;
for (const issue of issues) {
  const prs = JSON.parse(gh("pr", "list", "--repo", REPO, "--head", `agent/issue-${issue.number}`, "--state", "merged", "--json", "number,mergedAt,labels", "--limit", "5"));
  if (!shouldCloseAsCompleted(issue, prs)) continue;
  const merged = prs.find((p) => p.mergedAt);
  log(`同期: #${issue.number} はPR #${merged.number} がマージ済みのため、完了としてクローズします${DRY_RUN ? "（dry-run）" : ""}`);
  if (DRY_RUN) continue;
  gh("issue", "close", String(issue.number), "--repo", REPO, "--reason", "completed", "--comment", `エージェントのPR #${merged.number} がマージされたためクローズします。`);
  gh("issue", "edit", String(issue.number), "--repo", REPO, "--remove-label", LABEL_WORKING, "--remove-label", LABEL_READY, "--remove-label", LABEL_NEEDS_HUMAN);
  closed++;
}
log(`同期: ${closed} 件をクローズしました（対象 ${issues.length} 件を点検）`);
