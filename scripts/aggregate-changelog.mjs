#!/usr/bin/env node
/**
 * changelog.d/*.md の断片を CHANGELOG.md の指定セクションへ集約するCLI（Issue #230）。
 * 取り込んだ断片ファイルは既定で削除する（`--keep-fragments` で残せる）。
 *
 * 使い方:
 *   node scripts/aggregate-changelog.mjs --section "## 見出し（2026年10月・#230）"
 *     指定セクションへ集約して CHANGELOG.md を書き換え、取り込んだ断片を削除する。
 *     見出しが CHANGELOG.md に既存なら、その節の末尾に追記する（新規なら先頭の節として挿入）。
 *
 *   node scripts/aggregate-changelog.mjs --section "..." --dry-run
 *     結果を標準出力に表示するだけで、CHANGELOG.md・断片のどちらも変更しない。
 *
 *   node scripts/aggregate-changelog.mjs --section "..." --keep-fragments
 *     CHANGELOG.md は書き換えるが、断片ファイルは削除しない（確認しながら進めたい場合）。
 *
 *   node scripts/aggregate-changelog.mjs
 *     --section を省略すると「## 変更履歴断片の集約（YYYY年M月）」を既定の見出しにする。
 *
 * npm run changelog:draft（scripts/changelog-draft.mjs）とは別物:
 *   - changelog:draft は git ログから「下書き」を標準出力に出すだけで、
 *     CHANGELOG.md・changelog.d/ のどちらにも触れない（文面は人が判断して転記する）。
 *   - 本スクリプトは、各PRが既に changelog.d/ に積んだ「確定済みの断片」を
 *     実際に CHANGELOG.md へ書き込み、取り込んだ断片ファイルを削除する。
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateChangelog, defaultSectionHeading, isFragmentFile } from "./lib/aggregateChangelog.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const flag = (name) => args.includes(name);

const fragmentsDir = opt("--dir") ?? "changelog.d";
const changelogPath = opt("--changelog") ?? "CHANGELOG.md";
const sectionHeading = opt("--section") ?? defaultSectionHeading();
const dryRun = flag("--dry-run");
const keepFragments = flag("--keep-fragments");

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "使い方: node scripts/aggregate-changelog.mjs [--section \"## 見出し\"] [--dir changelog.d] [--changelog CHANGELOG.md] [--dry-run] [--keep-fragments]",
      "",
      "詳細はファイル冒頭のコメント、または docs/DEVELOPMENT_GUIDE.md を参照。",
    ].join("\n"),
  );
  process.exit(0);
}

const fragmentsAbsDir = join(REPO_ROOT, fragmentsDir);
const changelogAbsPath = join(REPO_ROOT, changelogPath);

const fragmentFiles = readdirSync(fragmentsAbsDir, { withFileTypes: true })
  .filter((d) => d.isFile() && isFragmentFile(d.name))
  .map((d) => d.name);

if (fragmentFiles.length === 0) {
  console.log(`${fragmentsDir}/ に集約対象の断片が見つからない（*.md のうち "_"/"." 始まりを除く）。何もしない。`);
  process.exit(0);
}

const rawFragments = fragmentFiles.map((name) => ({ name, content: readFileSync(join(fragmentsAbsDir, name), "utf8") }));
const changelogText = readFileSync(changelogAbsPath, "utf8");

const { content, items, emptySkipped, duplicateSkipped } = aggregateChangelog(changelogText, sectionHeading, rawFragments);

for (const name of emptySkipped) console.warn(`[skip] ${fragmentsDir}/${name}: 内容が空のためスキップ`);
for (const name of duplicateSkipped) console.warn(`[skip] ${fragmentsDir}/${name}: 既存の断片と内容が重複するためスキップ`);

if (items.length === 0) {
  console.log("集約対象の断片が1件も残らなかった（すべて空または重複）。CHANGELOG.md は変更しない。");
  process.exit(0);
}

console.log(`見出し: ${sectionHeading}`);
console.log(`集約する断片（${items.length}件、適用順）: ${items.map((i) => i.name).join(", ")}`);

if (dryRun) {
  const sectionStart = content.indexOf(sectionHeading);
  const rest = sectionStart === -1 ? content : content.slice(sectionStart);
  const nextHeadingIn = rest.slice(sectionHeading.length).search(/^## /m);
  const preview = sectionStart === -1 || nextHeadingIn === -1 ? rest : rest.slice(0, sectionHeading.length + nextHeadingIn);
  console.log("\n--- 集約後のセクション本文（--dry-run のため CHANGELOG.md・断片ファイルは変更していない） ---");
  console.log(preview.trimEnd());
  process.exit(0);
}

writeFileSync(changelogAbsPath, content);
console.log(`${changelogPath} を更新した。`);

if (!keepFragments) {
  for (const { name } of items) rmSync(join(fragmentsAbsDir, name));
  console.log(`取り込んだ断片ファイル（${items.length}件）を ${fragmentsDir}/ から削除した。`);
} else {
  console.log("--keep-fragments が指定されたため、断片ファイルは削除していない。");
}
