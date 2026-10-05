import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  LOCK_STALE_MS,
  ORPHANED_TRIAGE_STALE_MS,
  WORKING_STALE_MS,
  formatSummary,
  isLockStale,
  isOrphanedTriage,
  isStaleWorking,
  summarizeOutput,
} from "../agent/policy.js";
import { acquireLock, releaseLock } from "../agent/lock.mjs";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const alive = () => true;
const dead = () => false;

test("isLockStale: 所有プロセスが生きていて新しければ残骸ではない", () => {
  assert.equal(isLockStale({ pid: 1, startedAt: NOW - 1000 }, NOW, alive), false);
});

test("isLockStale: 所有プロセスが死んでいれば残骸", () => {
  assert.equal(isLockStale({ pid: 1, startedAt: NOW - 1000 }, NOW, dead), true);
});

test("isLockStale: プロセスが生きていても、古すぎれば残骸（ハングの回復）", () => {
  assert.equal(isLockStale({ pid: 1, startedAt: NOW - LOCK_STALE_MS - 1 }, NOW, alive), true);
});

test("isLockStale: 内容が壊れている・欠落しているロックは残骸として扱う", () => {
  assert.equal(isLockStale(null, NOW, alive), true);
  assert.equal(isLockStale(/** @type {any} */ ({ pid: "x", startedAt: NOW }), NOW, alive), true);
  assert.equal(isLockStale(/** @type {any} */ ({ pid: 1, startedAt: "x" }), NOW, alive), true);
});

test("isStaleWorking: agent-working のまま閾値を超えて更新されないIssueだけが対象", () => {
  const old = new Date(NOW - WORKING_STALE_MS - 60000).toISOString();
  const fresh = new Date(NOW - 60000).toISOString();
  const working = [{ name: "agent-working" }];
  assert.equal(isStaleWorking({ labels: working, updatedAt: old }, NOW), true);
  assert.equal(isStaleWorking({ labels: working, updatedAt: fresh }, NOW), false);
  assert.equal(isStaleWorking({ labels: [{ name: "agent-done" }], updatedAt: old }, NOW), false);
  assert.equal(isStaleWorking({ labels: working, updatedAt: "不正な日時" }, NOW), false);
});

test("isOrphanedTriage: agent-triagedのみで後続ラベルが無く、閾値を超えて放置されたIssueだけが対象（#127）", () => {
  const old = new Date(NOW - ORPHANED_TRIAGE_STALE_MS - 60000).toISOString();
  const triagedOnly = [{ name: "agent-triaged" }];
  assert.equal(isOrphanedTriage({ labels: triagedOnly, updatedAt: old }, NOW), true);
});

test("isOrphanedTriage: 直後（閾値内）はまだ対象にしない（トリアージ中の一時的な状態と区別できないため）", () => {
  const fresh = new Date(NOW - 60000).toISOString();
  assert.equal(isOrphanedTriage({ labels: [{ name: "agent-triaged" }], updatedAt: fresh }, NOW), false);
});

test("isOrphanedTriage: agent-triagedが無ければ対象外", () => {
  const old = new Date(NOW - ORPHANED_TRIAGE_STALE_MS - 60000).toISOString();
  assert.equal(isOrphanedTriage({ labels: [{ name: "agent-retry-1" }], updatedAt: old }, NOW), false);
});

test("isOrphanedTriage: agent-ready/agent-working/agent-done/agent-needs-human/agent-skipのいずれかが付いていれば対象外", () => {
  const old = new Date(NOW - ORPHANED_TRIAGE_STALE_MS - 60000).toISOString();
  for (const outcome of ["agent-ready", "agent-working", "agent-done", "agent-needs-human", "agent-skip"]) {
    const labels = [{ name: "agent-triaged" }, { name: outcome }];
    assert.equal(isOrphanedTriage({ labels, updatedAt: old }, NOW), false, `${outcome}が付いていれば対象外のはず`);
  }
});

test("isOrphanedTriage: updatedAtが不正な日時なら対象外（フェイルクローズ）", () => {
  assert.equal(isOrphanedTriage({ labels: [{ name: "agent-triaged" }], updatedAt: "不正な日時" }, NOW), false);
});

test("summarizeOutput: トリアージ結果・PR作成・中止を数える", () => {
  const out = [
    "[agent] #81 「A」→ needs-human（人手が必要）: 理由",
    "[agent] #82 「B」→ ready（実行してよい）: 理由",
    "[agent] #82 PRを作成しました: https://github.com/o/r/pull/90",
    "[agent] #83 中止: 検証に失敗しました",
    "無関係な行",
  ].join("\n");
  assert.deepEqual(summarizeOutput(out), { ready: 1, needsHuman: 1, prs: ["https://github.com/o/r/pull/90"], aborted: 1, scouted: 0, approved: 0, rejected: 0, reverted: 0, fixed: 0 });
});

test("summarizeOutput: 何も無ければすべて0", () => {
  assert.deepEqual(summarizeOutput(""), { ready: 0, needsHuman: 0, prs: [], aborted: 0, scouted: 0, approved: 0, rejected: 0, reverted: 0, fixed: 0 });
});

test("formatSummary: 回復があれば表示に含める", () => {
  const s = summarizeOutput("[agent] #1 「A」→ ready（実行してよい）: x");
  assert.match(formatSummary(s, 0), /実行可 1件/);
  assert.doesNotMatch(formatSummary(s, 0), /回復/);
  assert.match(formatSummary(s, 2), /回復: 2件/);
});

test("acquireLock: 取得でき、二重取得は拒否し、解放後は再取得できる", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kkt-lock-test-"));
  const file = path.join(dir, "sub", "cycle.lock");
  try {
    assert.equal(acquireLock(file), true);
    assert.equal(acquireLock(file), false, "自分のロックは生きているため二重取得できない");
    releaseLock(file);
    assert.equal(existsSync(file), false);
    assert.equal(acquireLock(file), true);
    releaseLock(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireLock: 所有プロセスが存在しない残骸ロックは奪い取って取得する", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kkt-lock-test-"));
  const file = path.join(dir, "cycle.lock");
  try {
    writeFileSync(file, JSON.stringify({ pid: 2 ** 22 + 12345, startedAt: Date.now() }));
    assert.equal(acquireLock(file), true);
    releaseLock(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireLock: 壊れたロックファイルは残骸として奪い取る", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kkt-lock-test-"));
  const file = path.join(dir, "cycle.lock");
  try {
    writeFileSync(file, "壊れた内容");
    assert.equal(acquireLock(file), true);
    releaseLock(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("releaseLock: 他プロセスのロックは解放しない", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kkt-lock-test-"));
  const file = path.join(dir, "cycle.lock");
  try {
    writeFileSync(file, JSON.stringify({ pid: process.pid + 1, startedAt: Date.now() }));
    releaseLock(file);
    assert.equal(existsSync(file), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- ループの自己計測と停滞検知（ADR-0017 Amendment 35） ---
import { STAGNANT_READY_DAYS, aggregateMetrics, buildMetricEntry, buildMetricsMarkdown, isStagnantReady, parseMetricLines } from "../agent/policy.js";

const DAY = 24 * 60 * 60 * 1000;
const issue = (labels, ageDays) => ({ labels: labels.map((name) => ({ name })), updatedAt: new Date(NOW - ageDays * DAY).toISOString() });

test("isStagnantReady: agent-ready のまま7日を超えたものだけ停滞", () => {
  assert.equal(isStagnantReady(issue(["agent-ready"], STAGNANT_READY_DAYS + 1), NOW), true);
  assert.equal(isStagnantReady(issue(["agent-ready"], STAGNANT_READY_DAYS - 1), NOW), false);
});

test("isStagnantReady: 処理中・人手待ち・対象外・ready無しは停滞ではない", () => {
  for (const other of ["agent-working", "agent-needs-human", "agent-skip", "agent-done"]) {
    assert.equal(isStagnantReady(issue(["agent-ready", other], 30), NOW), false, other);
  }
  assert.equal(isStagnantReady(issue(["bug"], 30), NOW), false);
  assert.equal(isStagnantReady({ labels: [{ name: "agent-ready" }], updatedAt: "壊れた日時" }, NOW), false);
});

test("buildMetricEntry: 所要時間・成否・利用枠逼迫を記録する", () => {
  const e = buildMetricEntry({ step: "run", startedMs: 1000, endedMs: 4500, status: 1, output: "" });
  assert.deepEqual(e, { at: new Date(4500).toISOString(), step: "run", ms: 3500, ok: false, usageLimit: false });
  assert.equal(buildMetricEntry({ step: "run", startedMs: 5, endedMs: 1, status: 0, output: "" }).ms, 0);
  assert.equal(buildMetricEntry({ step: "run", startedMs: 0, endedMs: 1, status: 0, output: "[利用枠の上限を検知]" }).usageLimit, true);
});

test("parseMetricLines: 壊れた行・形式違いは無視する", () => {
  const good = JSON.stringify({ at: "2026-09-30T00:00:00Z", step: "scout", ms: 10, ok: true, usageLimit: false });
  assert.equal(parseMetricLines(`${good}\n壊れた行\n{"step":1}\n\n${good}`).length, 2);
});

test("aggregateMetrics: 期間内をステップ別に集計し、失敗の多い順に並べる", () => {
  const at = (d) => new Date(NOW - d * DAY).toISOString();
  const entries = [
    { at: at(1), step: "run", ms: 1000, ok: false, usageLimit: true },
    { at: at(2), step: "run", ms: 3000, ok: true, usageLimit: false },
    { at: at(1), step: "scout", ms: 500, ok: true, usageLimit: false },
    { at: at(20), step: "scout", ms: 99999, ok: false, usageLimit: false },
  ];
  const agg = aggregateMetrics(entries, NOW - 7 * DAY);
  assert.deepEqual(agg.map((a) => a.step), ["run", "scout"]);
  assert.deepEqual(agg[0], { step: "run", runs: 2, failures: 1, throttled: 1, avgMs: 2000, maxMs: 3000 });
  assert.equal(agg[1].runs, 1);
  assert.match(buildMetricsMarkdown(agg), /\| run \| 2 \| 1 \| 1 \| 2\.0秒 \| 3\.0秒 \|/);
});
