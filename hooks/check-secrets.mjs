#!/usr/bin/env node
/**
 * ステージ済みの変更内容に、よくあるシークレット（APIキー・秘密鍵等）の
 * パターンが含まれていないかを簡易チェックするpre-commitフック本体。
 *
 * 【位置づけ】これは網羅的なSAST（静的解析）ツールの代替ではなく、
 * 「うっかり」の混入をコミット前に検知するための軽量な安全網。
 * 本プロジェクトは現状シークレットを持たないが、将来M4の通知連携や
 * M6のJCIP連携でAPIキー等が必要になった場合に備え、早い段階（シフトレフト）
 * で仕組みだけ導入しておく（docs/BEST_PRACTICES_AUDIT.md参照）。
 *
 * 誤検知でブロックされた場合は `git commit --no-verify` で一時的にバイパス
 * できる（本当に問題ないと確信できる場合のみ使うこと）。
 *
 * 依存パッケージを追加しないため、`git` コマンドをそのまま呼び出す。
 */
import { execFileSync } from "node:child_process";

/** @type {[RegExp, string][]} パターンとその説明 */
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, "AWSアクセスキーIDらしき文字列"],
  [/AIza[0-9A-Za-z\-_]{35}/, "Google APIキーらしき文字列"],
  [/xox[baprs]-[0-9A-Za-z-]{10,}/, "Slackトークンらしき文字列"],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "秘密鍵ファイルの中身らしき文字列"],
  [
    /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9\-_]{16,}["']/i,
    "APIキー・パスワードらしき変数への直書き",
  ],
];

function getStagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    encoding: "utf8",
  });
  return output.split("\n").filter(Boolean);
}

function getStagedContent(filePath) {
  try {
    return execFileSync("git", ["show", `:${filePath}`], { encoding: "utf8" });
  } catch {
    // バイナリファイル等、テキストとして読めない場合はスキップする。
    return "";
  }
}

function main() {
  const files = getStagedFiles();
  const findings = [];

  for (const file of files) {
    const content = getStagedContent(file);
    if (!content) continue;

    for (const [pattern, label] of SECRET_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        findings.push(`  - ${file}: ${label}（"${match[0].slice(0, 12)}..."）`);
      }
    }
  }

  if (findings.length > 0) {
    console.error("⚠ コミットをブロックしました: シークレットらしき文字列が検出されました。\n");
    console.error(findings.join("\n"));
    console.error(
      "\n実データであれば直ちに取り消し・ローテーションしてください。" +
        "\n誤検知の場合は `git commit --no-verify` でバイパスできます。"
    );
    process.exit(1);
  }
}

main();
