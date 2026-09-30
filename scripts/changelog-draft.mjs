#!/usr/bin/env node
/**
 * CHANGELOG.md 用の下書きを、gitの履歴から標準出力へ作る（ファイルは書き換えない）。
 *
 * 使い方:
 *   npm run changelog:draft                       直近30日
 *   npm run changelog:draft -- --since 2026-09-01  指定日以降
 *   npm run changelog:draft -- --title "見出し"
 */
import { execFileSync } from "node:child_process";
import { buildChangelogDraft } from "./lib/changelogDraft.mjs";

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const since = opt("--since") ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const title = opt("--title") ?? `変更履歴の下書き（${since} 以降）`;

const out = execFileSync("git", ["log", `--since=${since}`, "--first-parent", "--pretty=format:%s", "origin/main"], { encoding: "utf8" });
console.log(buildChangelogDraft(out.split("\n"), { title, repo: "satou-aaaaa/sandbox" }));
