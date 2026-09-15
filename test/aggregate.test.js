import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateEligibility, formatChecksSection } from "../src/core/eligibility/aggregate.js";

/** @param {boolean} passed @param {string} label @returns {import('../src/core/eligibility/types.js').RequirementCheckResult} */
function makeCheck(passed, label = "テスト要件") {
  return { key: "test", label, passed, reasons: passed ? ["満たしています"] : ["満たしていません"], warnings: [] };
}

test("aggregateEligibility: 全要件合格ならeligible=trueでblockingIssuesは空", () => {
  const result = aggregateEligibility([makeCheck(true, "要件A"), makeCheck(true, "要件B")]);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.blockingIssues, []);
});

test("aggregateEligibility: 一部不合格ならeligible=falseで不合格分のみblockingIssuesに含まれる", () => {
  const result = aggregateEligibility([makeCheck(true, "要件A"), makeCheck(false, "要件B")]);
  assert.equal(result.eligible, false);
  assert.equal(result.blockingIssues.length, 1);
  assert.match(result.blockingIssues[0], /要件B/);
});

test("aggregateEligibility: 全要件不合格ならeligible=falseで全件がblockingIssuesに含まれる", () => {
  const result = aggregateEligibility([makeCheck(false, "要件A"), makeCheck(false, "要件B")]);
  assert.equal(result.eligible, false);
  assert.equal(result.blockingIssues.length, 2);
});

test("formatChecksSection: 各要件の合否記号・理由・警告を行として組み立てる", () => {
  const checks = [
    { key: "a", label: "要件A", passed: true, reasons: ["理由1"], warnings: ["注意1"] },
    { key: "b", label: "要件B", passed: false, reasons: ["理由2"], warnings: [] },
  ];
  const lines = formatChecksSection(checks);
  assert.ok(lines.includes("## ○ 要件A"));
  assert.ok(lines.includes("- 理由1"));
  assert.ok(lines.includes("  - ⚠ 注意1"));
  assert.ok(lines.includes("## × 要件B"));
  assert.ok(lines.includes("- 理由2"));
});

test("formatChecksSection: 空配列なら空配列を返す", () => {
  assert.deepEqual(formatChecksSection([]), []);
});
