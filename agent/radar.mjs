#!/usr/bin/env node
/**
 * ニュース・公式情報の点検（レーダー）。
 *
 * 固定の公式情報源（コードが引用している法令の改正履歴〈e-Gov〉、Node.jsのサポート期限）を決定的に取得し、
 * 読み取り専用のエージェントが「このリポジトリへの影響」を評価して、根拠つきのIssueを起票する。
 * エージェントにはWebアクセス権を与えない（取得済みの事実をデータとして渡す）。取得は許可ホストへのGETのみ。
 * 本文に取得した出典URLを含まない報告は捨てる（根拠のない「ニュース」を起票しない）。
 *
 * 起票されたIssueは agent-radar のみ付き、通常の自動トリアージに乗る（法令ロジックに関わるものは、
 * トリアージの決定的ルールにより自動実装されず、人手に回る）。
 *
 * 歯止め: 1回あたり最大2件、未完了のレーダーIssueが5件以上なら起票しない、既存Issueと重複しない、日次費用上限を共有。
 *
 * 使い方:
 *   node radar.mjs --dry-run    取得した事実と提案を表示するのみ（起票しない）
 *   node radar.mjs              起票する
 *
 * 設計の根拠: docs/adr/0017-agent-sdk-issue-loop.md（Amendment 34）
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAILY_LIMITS } from "./policy.js";
import { LABEL_RADAR, NODE_SCHEDULE_URL, RADAR_MAX_LAWS, RADAR_MAX_OPEN, buildRadarFacts, buildRadarPrompt, extractLawIds, isAllowedSourceUrl, lawRevisionsUrl, nodeSupportStatus, parseLawRevisions, parseNodeMajor, parseRadarFindings, selectRadarFindings } from "./radar-lib.js";
import { runAgent } from "./runner.mjs";
import { AUTH, BASE, LOG_DIR, REPO, SANDBOX, buildImage, dockerAvailable, dockerPhase, gh, loadState, log, run, saveState } from "./run.mjs";

const AGENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const KILL_SWITCH_FILE = join(AGENT_DIR, ".disabled");
const DRY_RUN = process.argv.includes("--dry-run");
const FETCH_TIMEOUT_MS = 15000;
const FETCH_MAX_BYTES = 2_000_000;

/**
 * 許可ホストのURLだけをGETしてJSONを返す。失敗は null（その情報源を飛ばして続行する）。
 * @param {string} url
 * @returns {Promise<unknown | null>}
 */
async function fetchJson(url) {
  if (!isAllowedSourceUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "error", headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > FETCH_MAX_BYTES) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * ソース・文書ツリーから、引用されている法令IDを集める。
 * @param {string} root
 * @returns {string[]}
 */
function collectLawIds(root) {
  /** @type {Set<string>} */
  const ids = new Set();
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "data") continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(js|mjs|md)$/.test(name) && st.size < 500_000) extractLawIds(readFileSync(p, "utf8")).forEach((i) => ids.add(i));
    }
  };
  for (const d of ["src", "docs"]) if (existsSync(join(root, d))) walk(join(root, d));
  return [...ids].sort();
}

async function main() {
  if (existsSync(KILL_SWITCH_FILE) || process.env.AGENT_DISABLED === "1") {
    log("キルスイッチが有効です。何もせず終了します");
    return;
  }
  if (loadState().costUsd >= DAILY_LIMITS.maxCostUsd) {
    log("本日の費用上限に達しているため、レーダーをスキップします");
    return;
  }
  const open = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "open", "--label", LABEL_RADAR, "--json", "body", "--limit", "50"));
  if (open.length >= RADAR_MAX_OPEN) {
    log(`レーダー: 未完了のレーダーIssueが ${open.length} 件あるため、新規の起票はしません（上限 ${RADAR_MAX_OPEN}）`);
    return;
  }
  const openBodies = open.map((/** @type {{body: string}} */ i) => i.body ?? "");
  if (AUTH.error) {
    console.error(AUTH.error);
    process.exit(1);
  }
  if (SANDBOX === "docker") {
    if (!dockerAvailable()) {
      console.error("Dockerに接続できません。Docker Desktopを起動するか、AGENT_SANDBOX=none を明示してください。");
      process.exit(1);
    }
    buildImage();
  }
  const existingTitles = JSON.parse(gh("issue", "list", "--repo", REPO, "--state", "all", "--json", "title", "--limit", "300")).map((/** @type {{title: string}} */ i) => i.title);

  run("git", ["fetch", "origin", BASE]);
  const workDir = join(mkdtempSync(join(tmpdir(), "kkt-radar-")), "tree");
  run("git", ["worktree", "add", "--detach", workDir, `origin/${BASE}`]);
  try {
    const now = new Date();
    // 1) 固定の公式情報源を決定的に取得する（エージェントはWebに触れない）
    const lawIds = collectLawIds(workDir).slice(0, RADAR_MAX_LAWS);
    /** @type {import("./radar-lib.js").LawChange[]} */
    const laws = [];
    let lawsOk = 0;
    for (const id of lawIds) {
      const json = await fetchJson(lawRevisionsUrl(id));
      if (json === null) continue;
      lawsOk++;
      laws.push(...parseLawRevisions(id, json, now));
    }
    const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));
    const major = parseNodeMajor(pkg.engines?.node);
    const schedule = major === null ? null : await fetchJson(NODE_SCHEDULE_URL);
    const node = major === null ? null : nodeSupportStatus(schedule, major, now);
    log(`レーダー: 法令 ${lawsOk}/${lawIds.length} 件の改正履歴を取得、改正 ${laws.length} 件。Node.js期限: ${node ? `${node.version} 終了 ${node.end}` : "取得できず"}`);

    // Node.jsは期限まで1年以上あれば事実に含めない（ノイズを避ける）
    const { facts, urls } = buildRadarFacts({ laws, node: node && node.daysLeft <= 365 ? node : null });
    if (facts.length === 0) {
      log("レーダー: 評価すべき新しい事実がありません。起票しません");
      return;
    }
    if (DRY_RUN) for (const f of facts) log(`  [事実] ${f}`);

    // 2) 読み取り専用のエージェントが、リポジトリへの影響を評価する
    const prompt = buildRadarPrompt(facts);
    const auditName = `${now.toISOString().replace(/[:.]/g, "-")}-radar.jsonl`;
    mkdirSync(LOG_DIR, { recursive: true });
    const res = SANDBOX === "docker" ? dockerPhase("triage", workDir, auditName, prompt) : await runAgent(prompt, workDir, join(LOG_DIR, auditName), "triage");
    const s = loadState();
    saveState({ ...s, costUsd: s.costUsd + (res.cost ?? 0) });
    if (!res.ok) {
      log("レーダー: エージェントが正常終了しなかったため、起票しません");
      return;
    }
    const picked = selectRadarFindings(parseRadarFindings(res.summary, urls), existingTitles, openBodies, urls);
    log(`レーダー: 報告を ${picked.length} 件採用します（出典URL・重複・上限・形式を確認後）`);
    if (picked.length > 0 && !DRY_RUN) {
      gh("label", "create", LABEL_RADAR, "--repo", REPO, "--color", "5319e7", "--description", "エージェントが公式情報（法令改正・実行環境の期限）から起票", "--force");
    }
    for (const issue of picked) {
      if (DRY_RUN) {
        log(`  [dry-run] ${issue.title}`);
        continue;
      }
      const url = gh("issue", "create", "--repo", REPO, "--title", issue.title, "--body", `${issue.body}\n\n---\n_エージェントのレーダーが公式情報から起票しました（\`${LABEL_RADAR}\`）。改正の内容は、必ず一次資料（出典URL）で確認してください。_`, "--label", LABEL_RADAR);
      log(`レーダー: 起票しました: ${url}`);
    }
  } finally {
    try {
      run("git", ["worktree", "remove", "--force", workDir]);
      rmSync(dirname(workDir), { recursive: true, force: true });
    } catch {
      /* 後始末の失敗は結果に影響させない */
    }
  }
}

await main();
