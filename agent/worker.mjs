#!/usr/bin/env node
/**
 * コンテナ内のエントリポイント（隔離モード専用）。
 *
 * ホストの `run.mjs` が `docker run` で起動する。フェーズは引数で指定する:
 *   install  作業ツリーで `npm ci`
 *   agent    /task/prompt.txt を読みエージェントを実行（監査ログは /logs へ）
 *   triage   /task/prompt.txt を読み、作業ツリー（読み取り専用）を評価する
 *   verify   test / typecheck / lint（check-secretsはホスト側）
 *
 * 結果は標準出力の最終行に `RESULT:<JSON>` として返す（ホストが解釈する）。
 * このプロセスにはGitHub認証情報もgit操作も存在しない。
 */
import { readFileSync } from "node:fs";
import { installDeps, runAgent, verifyAll } from "./runner.mjs";

const WORKSPACE = "/workspace";
const phase = process.argv[2];

/** @param {unknown} obj */
function result(obj) {
  console.log(`RESULT:${JSON.stringify(obj)}`);
}

if (phase === "install") {
  installDeps(WORKSPACE);
  result({ ok: true });
} else if (phase === "agent") {
  const prompt = readFileSync("/task/prompt.txt", "utf8");
  const auditFile = `/logs/${process.env.AUDIT_NAME || "audit.jsonl"}`;
  result(await runAgent(prompt, WORKSPACE, auditFile));
} else if (phase === "triage") {
  // 作業ツリーは読み取り専用でマウントされている。評価のみ（コードは変更しない）
  const prompt = readFileSync("/task/prompt.txt", "utf8");
  const auditFile = `/logs/${process.env.AUDIT_NAME || "triage.jsonl"}`;
  result(await runAgent(prompt, WORKSPACE, auditFile, "triage"));
} else if (phase === "verify") {
  // check-secrets はgitを使うため、コンテナ外（ホスト側）で実行する
  result({ failure: verifyAll(WORKSPACE, { secrets: false }) });
} else {
  console.error(`不明なフェーズ: ${phase}`);
  process.exit(2);
}
