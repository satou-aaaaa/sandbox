/**
 * エージェント実行と検証の実体（SDK呼び出し・npmスクリプト実行）。
 *
 * 隔離モード（Docker）ではコンテナ内の `worker.mjs` から、隔離なしモードでは
 * `run.mjs` から直接呼ばれる。GitHub認証情報・push・PR作成は一切扱わない
 * （それらはホスト側の `run.mjs` だけが持つ）。
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_TOOLS,
  USAGE_LIMIT_MARKER,
  looksLikeUsageLimit,
  DISALLOWED_TOOLS,
  TRIAGE_ALLOWED_TOOLS,
  TRIAGE_DISALLOWED_TOOLS,
  REVIEW_MODEL,
  buildAgentEnv,
  decideToolUse,
} from "./policy.js";

/** 1件あたりの上限（暴走・費用超過の歯止め） */
export const MAX_TURNS = 40;
export const MAX_BUDGET_USD = 3;
/** 1回のエージェント実行の壁時計上限（ハング対策） */
export const AGENT_TIMEOUT_MS = 20 * 60 * 1000;
/** 使用モデル（環境変数 AGENT_MODEL で上書き可）。 */
export const MODEL = process.env.AGENT_MODEL || "claude-sonnet-5-5";

/**
 * エージェントを1回実行する。PreToolUseフックで全ツール呼び出しを監査ログへ記録し、
 * policy.decideToolUse で二重に可否判定する（許可リストと独立した最終防衛線。
 * フックのdenyはどの権限モードでも効く）。
 * @param {string} prompt
 * @param {string} workDir
 * @param {string} auditFile
 * @param {"implement"|"triage"|"review"} [mode] triage は読み取り専用・短時間・低予算で評価だけを行う。review は独立したレビュアー（別の強いモデル・読み取り専用）
 * @returns {Promise<{ok: boolean, cost: number, summary: string, usageLimit?: boolean}>}
 */
export async function runAgent(prompt, workDir, auditFile, mode = "implement") {
  const review = mode === "review";
  // triage / review は読み取り専用（Read/Glob/Grepのみ）。implement だけが編集・テスト実行できる
  const triage = mode === "triage" || review;
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS);
  const audit = (entry) => appendFileSync(auditFile, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
  /** @type {import("@anthropic-ai/claude-agent-sdk").HookCallback} */
  const preToolUse = async (input) => {
    const { tool_name: tool, tool_input: toolInput } = /** @type {any} */ (input);
    const verdict = decideToolUse(tool, toolInput ?? {}, workDir);
    audit({ event: "tool", tool, input: toolInput, decision: verdict.decision, reason: verdict.decision === "deny" ? verdict.reason : undefined });
    if (verdict.decision === "deny") {
      return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.reason } };
    }
    return {};
  };
  let cost = 0;
  let ok = false;
  let summary = "";
  let usageLimit = false;
  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: workDir,
        // レビュアーは実装側とは別の（より強い）モデルを使い、判断の独立性を高める
        model: review ? process.env.AGENT_REVIEW_MODEL || REVIEW_MODEL : MODEL,
        abortController,
        maxTurns: review ? 25 : triage ? 15 : MAX_TURNS,
        maxBudgetUsd: review ? 2 : triage ? 1 : MAX_BUDGET_USD,
        permissionMode: "dontAsk",
        allowedTools: triage ? TRIAGE_ALLOWED_TOOLS : ALLOWED_TOOLS,
        disallowedTools: triage ? TRIAGE_DISALLOWED_TOOLS : DISALLOWED_TOOLS,
        hooks: { PreToolUse: [{ hooks: [preToolUse] }] },
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        // サブスクリプション認証（既定）では、環境にあってもAPIキー系は渡さない（従量課金の防止）
        env: buildAgentEnv(process.env, process.env.AGENT_AUTH === "api-key" || process.env.AGENT_AUTH === "inherit" ? [] : ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]),
        persistSession: false,
      },
    })) {
      if (message.type === "result") {
        cost = message.total_cost_usd ?? 0;
        ok = message.subtype === "success";
        summary = "result" in message ? String(message.result ?? "") : "";
        audit({ event: "result", subtype: message.subtype, cost, turns: message.num_turns });
        console.error(`[agent] エージェント終了: ${message.subtype}（費用 ${cost.toFixed(4)}, ${message.num_turns}ターン）`);
        if (!ok && looksLikeUsageLimit(`${summary} ${JSON.stringify(message)}`)) usageLimit = true;
      }
    }
  } catch (err) {
    audit({ event: "error", message: err instanceof Error ? err.message : String(err) });
    console.error(`[agent] エージェント実行エラー: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
  if (usageLimit) console.error(`[agent] ${USAGE_LIMIT_MARKER}`);
  return { ok, cost, summary, usageLimit };
}

/**
 * npm を起動するコマンドと引数を返す。Windowsでは npm が .cmd のため cmd.exe 経由にする
 * （`shell: true` に引数を渡すと DEP0190 の警告が出るため。引数は固定の安全な値のみ）。
 * @param {string[]} npmArgs
 * @returns {[string, string[]]}
 */
export function npmCommand(npmArgs) {
  return process.platform === "win32" ? ["cmd.exe", ["/d", "/s", "/c", "npm", ...npmArgs]] : ["npm", npmArgs];
}

/**
 * 検証コマンドを順に実行し、最初の失敗を返す。
 * @param {string} workDir
 * @param {{secrets?: boolean}} [opts] secrets=false で check-secrets を省く
 *   （gitに依存するため、コンテナ内ではなくホスト側で別途実行する）
 * @returns {{name: string, output: string} | null}
 */
export function verifyAll(workDir, { secrets = true } = {}) {
  const scripts = [["test"], ["run", "typecheck"], ["run", "lint"]];
  if (secrets) scripts.push(["run", "check-secrets"]);
  for (const script of scripts) {
    try {
      execFileSync(...npmCommand(script), { cwd: workDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      const e = /** @type {any} */ (err);
      return { name: `npm ${script.join(" ")}`, output: `${e.stdout ?? ""}\n${e.stderr ?? ""}` };
    }
  }
  return null;
}

/**
 * 依存のインストール（`npm ci`）。
 * @param {string} workDir
 */
export function installDeps(workDir) {
  execFileSync(...npmCommand(["ci", "--no-audit", "--no-fund"]), { cwd: workDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * 指定ファイルだけを対象にStrykerを実行し、JSONレポート（必要な項目だけ）を返す。
 * 作業ツリーに依存（devDependencies）が入っている前提。失敗・時間切れは ok: false。
 * @param {string} workDir
 * @param {string[]} files 変更対象（リポジトリルートからの相対パス）
 * @param {number} timeoutMs
 * @returns {{ok: boolean, report?: unknown, error?: string}}
 */
export function runMutationTests(workDir, files, timeoutMs) {
  try {
    execFileSync(...npmCommand(["exec", "--", "stryker", "run", "--mutate", files.join(","), "--reporters", "json", "--concurrency", "2"]), {
      cwd: workDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    const raw = JSON.parse(readFileSync(join(workDir, "reports", "mutation", "mutation.json"), "utf8"));
    /** @type {Record<string, {mutants: {status: string, mutatorName: string, location: {start: {line: number}}}[]}>} */
    const slim = Object.fromEntries(
      Object.entries(raw.files ?? {}).map(([f, d]) => [
        f,
        { mutants: (d.mutants ?? []).map((m) => ({ status: m.status, mutatorName: m.mutatorName, location: { start: { line: m.location?.start?.line } } })) },
      ]),
    );
    return { ok: true, report: { files: slim } };
  } catch (err) {
    const e = /** @type {any} */ (err);
    return { ok: false, error: e.code === "ETIMEDOUT" ? "時間切れ" : String(e.message ?? e).slice(0, 500) };
  }
}
