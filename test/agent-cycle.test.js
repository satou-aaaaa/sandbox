import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  LOCK_STALE_MS,
  WORKING_STALE_MS,
  formatSummary,
  isLockStale,
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

test("summarizeOutput: トリアージ結果・PR作成・中止を数える", () => {
  const out = [
    "[agent] #81 「A」→ needs-human（人手が必要）: 理由",
    "[agent] #82 「B」→ ready（実行してよい）: 理由",
    "[agent] #82 PRを作成しました: https://github.com/o/r/pull/90",
    "[agent] #83 中止: 検証に失敗しました",
    "無関係な行",
  ].join("\n");
  assert.deepEqual(summarizeOutput(out), { ready: 1, needsHuman: 1, prs: ["https://github.com/o/r/pull/90"], aborted: 1 });
});

test("summarizeOutput: 何も無ければすべて0", () => {
  assert.deepEqual(summarizeOutput(""), { ready: 0, needsHuman: 0, prs: [], aborted: 0 });
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
