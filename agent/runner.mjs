/**
 * エージェント実行と検証の実体（SDK呼び出し・npmスクリプト実行）。
 *
 * 隔離モード（Docker）ではコンテナ内の `worker.mjs` から、隔離なしモードでは
 * `run.mjs` から直接呼ばれる。GitHub認証情報・push・PR作成は一切扱わない
 * （それらはホスト側の `run.mjs` だけが持つ）。
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import {
  ALLOWED_TOOLS,
  DISALLOWED_TOOLS,
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
 * @returns {Promise<{ok: boolean, cost: number, summary: string}>}
 */
export async function runAgent(prompt, workDir, auditFile) {
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
  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: workDir,
        model: MODEL,
        abortController,
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        permissionMode: "dontAsk",
        allowedTools: ALLOWED_TOOLS,
        disallowedTools: DISALLOWED_TOOLS,
        hooks: { PreToolUse: [{ hooks: [preToolUse] }] },
        settingSources: ["project"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        // サブスクリプション認証（既定）では、環境にあってもAPIキー系は渡さない（従量課金の防止）
        env: buildAgentEnv(process.env, process.env.AGENT_AUTH === "api-key" ? [] : ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]),
        persistSession: false,
      },
    })) {
      if (message.type === "result") {
        cost = message.total_cost_usd ?? 0;
        ok = message.subtype === "success";
        summary = "result" in message ? String(message.result ?? "") : "";
        audit({ event: "result", subtype: message.subtype, cost, turns: message.num_turns });
        console.error(`[agent] エージェント終了: ${message.subtype}（費用 $${cost.toFixed(4)}, ${message.num_turns}ターン）`);
      }
    }
  } catch (err) {
    audit({ event: "error", message: err instanceof Error ? err.message : String(err) });
    console.error(`[agent] エージェント実行エラー: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
  return { ok, cost, summary };
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
      execFileSync("npm", script, { cwd: workDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
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
  execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: workDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
}
