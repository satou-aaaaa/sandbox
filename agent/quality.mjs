#!/usr/bin/env node
/**
 * エージェントの品質指標。マージ済みのエージェントPRのラベルから、AIレビュー承認後の取り消し率を集計して表示する。
 * GitHubの状態を読むだけで、何も書き換えない。LLMは使わない（費用ゼロ・誤りの混入なし）。
 *
 * 使い方:
 *   node quality.mjs
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 31）
 */
import { LABEL_PR, buildQualityMarkdown, computeQuality } from "./policy.js";
import { REPO, gh } from "./run.mjs";

const prs = JSON.parse(gh("pr", "list", "--repo", REPO, "--state", "merged", "--label", LABEL_PR, "--json", "number,labels", "--limit", "500"));
console.log(buildQualityMarkdown(computeQuality(prs)));
