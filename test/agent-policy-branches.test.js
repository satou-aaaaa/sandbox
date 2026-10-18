// agent/policy.js の、既存テストで通っていなかった分岐（境界・省略時の既定値・壊れた入力）を確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  aggregateMetrics,
  buildQualityMarkdown,
  buildReport,
  decideFix,
  decideReviewVerdict,
  decideToolUse,
  evaluateMutation,
  normalizeState,
  parseAuditFindings,
  parseChangedLines,
  parseReviewVerdict,
  parseScoutIssues,
  parseScoutVerdict,
  pickMajorUpdates,
  scoutFingerprint,
  summarizeChecks,
} from "../agent/policy.js";

const CWD = path.resolve("/tmp/agent-work");

const baseReport = () => ({
  periodLabel: "直近24時間",
  agentMerged: 0,
  autoMerged: 0,
  reverted: 0,
  humanMerged: 0,
  dependabotMerged: 0,
  aiApproved: 0,
  aiRejected: 0,
  needsHuman: [],
  incidents: [],
  needsReview: [],
  failing: [],
  costUsd: null,
  selftest: null,
  breaker: false,
});

test("decideToolUse: Read/Glob/Grep は path でも判定し、対象が無ければ許可する", () => {
  assert.equal(decideToolUse("Grep", { path: path.join(CWD, "src") }, CWD).decision, "allow");
  assert.equal(decideToolUse("Glob", { path: "/etc" }, CWD).decision, "deny");
  assert.equal(decideToolUse("Grep", { path: path.join(CWD, ".env") }, CWD).decision, "deny");
  assert.deepEqual(decideToolUse("Glob", { pattern: "**/*.js" }, CWD), { decision: "allow" });
});

test("decideToolUse: command の無い Bash と、対象外のツールは許可する", () => {
  assert.deepEqual(decideToolUse("Bash", {}, CWD), { decision: "allow" });
  assert.deepEqual(decideToolUse("TodoWrite", { todos: [] }, CWD), { decision: "allow" });
});

test("normalizeState: runs・costUsd が数でない状態は新規扱いにする", () => {
  const fresh = { date: "2026-10-18", runs: 0, costUsd: 0 };
  assert.deepEqual(normalizeState({ date: "2026-10-18", runs: Number.NaN, costUsd: 1 }, "2026-10-18"), fresh);
  assert.deepEqual(normalizeState({ date: "2026-10-18", runs: 2, costUsd: Infinity }, "2026-10-18"), fresh);
  const ok = { date: "2026-10-18", runs: 2, costUsd: 1.5 };
  assert.equal(normalizeState(ok, "2026-10-18"), ok);
});

const acceptBody = "背景".repeat(30) + "\n\n## 受け入れ条件\n- 既存のテストがすべて通ること\n- 追加した振る舞いにテストがあること";

test("parseScoutIssues・scoutFingerprint: ファイル名を含まない本文でも受け付け、指紋は種別だけで決まる", () => {
  const line = JSON.stringify({ title: "改善: 文言を統一して読みやすくする", body: acceptBody });
  const issues = parseScoutIssues(`前置き\n${line}`);
  assert.equal(issues.length, 1);
  const fp = scoutFingerprint(issues[0]);
  assert.match(fp, /^[0-9a-f]{12}$/);
  // 同じ種別・同じ（空の）ファイル集合なら、タイトルの言い回しが違っても同じ指紋
  assert.equal(scoutFingerprint({ title: "改善：別の言い回し", body: acceptBody }), fp);
  assert.notEqual(scoutFingerprint({ title: "修正: 別の言い回し", body: acceptBody }), fp);
});

test("parseScoutVerdict: 壊れたJSON行は飛ばして前の行を使う。reason が文字列でなければ空", () => {
  assert.deepEqual(parseScoutVerdict('{"verdict":"confirmed","reason":"確認済み"}\n{壊れた行}'), { confirmed: true, reason: "確認済み" });
  assert.deepEqual(parseScoutVerdict('{"verdict":"rejected","reason":1}'), { confirmed: false, reason: "" });
  assert.equal(parseScoutVerdict("{not json}").confirmed, false);
});

test("parseAuditFindings: 本文が短すぎる・長すぎる指摘は捨てる", () => {
  const body = (n) => "## 根拠\n## 推奨対応\n" + "あ".repeat(n);
  const mk = (b) => JSON.stringify({ title: "点検: 入力検証が不足している箇所", body: b });
  assert.equal(parseAuditFindings(mk(body(10))).length, 0);
  assert.equal(parseAuditFindings(mk(body(4000))).length, 0);
  assert.equal(parseAuditFindings(mk(body(200))).length, 1);
});

test("parseReviewVerdict: 壊れたJSON行は飛ばし、その前の正しい判定を使う", () => {
  const checks = { requirements: "pass", tests: "pass", scope: "pass", secrets: "pass", compatibility: "na", legalCitation: "na" };
  const good = JSON.stringify({ approve: true, checks, reasons: ["問題なし"] });
  const v = parseReviewVerdict(`${good}\n{壊れた}`);
  assert.ok(v);
  assert.equal(v.approve, true);
  assert.deepEqual(v.reasons, ["問題なし"]);
});

test("decideReviewVerdict: 理由なしの不承認には既定の理由を付ける", () => {
  const checks = { requirements: "pass", tests: "pass", scope: "pass", secrets: "pass", compatibility: "pass", legalCitation: "pass" };
  assert.deepEqual(decideReviewVerdict({ approve: false, checks, reasons: [] }, { legal: false }), { approve: false, reasons: ["レビュアーが不承認としました"] });
});

test("summarizeChecks: 完了済みでも結論が未知（空）なら pending", () => {
  assert.equal(summarizeChecks([{ status: "COMPLETED", conclusion: "" }]), "pending");
  assert.equal(summarizeChecks([{ status: "COMPLETED", conclusion: "SUCCESS" }, { state: "EXPECTED" }]), "pending");
});

test("decideFix: statusCheckRollup が無い PR は CI 失敗とみなさない", () => {
  const r = decideFix({ labels: [], headRefName: "agent/issue-12" });
  assert.equal(r.action, "skip");
  assert.deepEqual(r.kinds, []);
  const pm = pickMajorUpdates([{ number: 3, title: "Bump x from 1.0.0 to 2.0.0", headRefName: "dependabot/npm/x" }]);
  assert.deepEqual(pm, [{ number: 3, title: "Bump x from 1.0.0 to 2.0.0", checks: "pending" }]);
});

test("buildReport: 要対応の各項目（承認待ち・CI失敗・滞留・点検失敗の段階不明）を列挙する", () => {
  const stalePrs = Array.from({ length: 12 }, (_, i) => ({ number: 100 + i, title: `PR${i}`, days: 6 + i }));
  const r = buildReport({
    ...baseReport(),
    needsReview: [{ number: 5, title: "承認待ち" }],
    failing: [{ number: 6, title: "CI失敗" }],
    stalePrs,
    stagnantReady: 3,
    selftest: { ok: false, lastRun: "2026-10-17T03:00:00Z" },
  });
  assert.match(r, /🔴 障害あり/);
  assert.match(r, /自動点検が失敗しました（段階不明）/);
  assert.match(r, /承認待ちのPR 1件:\n- #5 承認待ち/);
  assert.match(r, /CIが失敗しているエージェントのPR 1件/);
  assert.match(r, /PR 12件:/);
  assert.match(r, /- …ほか2件/);
  assert.doesNotMatch(r, /#110 /);
  assert.match(r, /作業待ちIssue（agent-ready）が 3件/);
  assert.match(r, /\| 自動点検 \| 失敗（2026-10-17） \|/);
});

test("buildReport: 自動点検の成功と、空のメトリクスは表に出さない", () => {
  const r = buildReport({ ...baseReport(), selftest: { ok: true, lastRun: "2026-10-16T00:00:00Z" }, metrics: [] });
  assert.match(r, /🟢 問題なし/);
  assert.match(r, /\| 自動点検 \| 成功（2026-10-16） \|/);
  assert.doesNotMatch(r, /ステップ別/);
  const withMetrics = buildReport({ ...baseReport(), metrics: [{ step: "triage", runs: 2, failures: 1, throttled: 0, avgMs: 1500, maxMs: 2000 }] });
  assert.match(withMetrics, /### ステップ別の実行状況/);
  assert.match(withMetrics, /\| triage \| 2 \| 1 \| 0 \| 1\.5秒 \| 2\.0秒 \|/);
});

test("buildQualityMarkdown: 件数が十分なら参考値の注記を出さない", () => {
  const md = buildQualityMarkdown({ merged: 30, aiApproved: 25, aiApprovedReverted: 1, otherReverted: 0, revertRate: 0.04, reliable: true });
  assert.match(md, /件数は十分です/);
  assert.match(md, /4\.0%（1\/25）/);
  assert.doesNotMatch(md, /参考値/);
});

test("parseChangedLines: 削除されたファイル（+++ /dev/null）の行は数えない", () => {
  const diff = ["--- a/old.js", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-a", "-b", "--- a/x.js", "+++ b/x.js", "@@ -1 +1,2 @@", " keep", "+add"].join("\n");
  assert.deepEqual(parseChangedLines(diff), { "x.js": [2] });
});

test("evaluateMutation: 変更の無いファイル・mutants の無いデータ・対象外の状態は数えない", () => {
  const report = {
    files: {
      "src/a.js": { mutants: [{ status: "Killed", location: { start: { line: 1 } } }, { status: "CompileError", location: { start: { line: 1 } } }] },
      "src/b.js": { mutants: [{ status: "Survived", location: { start: { line: 1 } } }] },
      "src/e.js": { mutants: [{ status: "Survived", location: { start: { line: 7 } } }] },
      "src/c.js": {},
      "src/d.js": { mutants: [{ status: "NoCoverage", mutatorName: "ConditionalExpression", location: { start: { line: 4 } } }] },
    },
  };
  const r = evaluateMutation(report, { "src/a.js": [1], "src/c.js": [1] });
  assert.equal(r.total, 1);
  assert.equal(r.killed, 1);
  assert.equal(r.score, 100);
  assert.deepEqual(r.survivors, []);
  assert.equal(r.ok, true);
  // テストが届いていない（NoCoverage）ミュータントは生き残りとして数える
  const r2 = evaluateMutation(report, { "src/a.js": [1], "src/d.js": [4] });
  assert.equal(r2.total, 2);
  assert.equal(r2.score, 50);
  assert.deepEqual(r2.survivors, [{ file: "src/d.js", line: 4, mutator: "ConditionalExpression" }]);
  assert.equal(r2.ok, false);
  // mutatorName の無いミュータントは、名前を空文字として報告する
  const r3 = evaluateMutation(report, { "src/e.js": [7] });
  assert.deepEqual(r3.survivors, [{ file: "src/e.js", line: 7, mutator: "" }]);
  assert.equal(r3.score, 0);
});

test("aggregateMetrics: 失敗回数が同じなら平均所要時間の長い順", () => {
  const at = "2026-10-17T00:00:00Z";
  const agg = aggregateMetrics(
    [
      { step: "fast", ok: true, ms: 100, at },
      { step: "slow", ok: true, ms: 900, at },
      { step: "slow", ok: true, ms: 1100, at },
    ],
    0,
  );
  assert.deepEqual(
    agg.map((a) => [a.step, a.avgMs]),
    [
      ["slow", 1000],
      ["fast", 100],
    ],
  );
});
