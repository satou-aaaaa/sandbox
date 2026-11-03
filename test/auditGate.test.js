// CI の npm audit の判定（scripts/lib/auditGate.mjs）の検査。
// 2026-10-24、zod の高深刻度の脆弱性が公表された日に、関係のない Dependabot の PR 5本が全部 npm audit で止まった。
// PR では「その PR が持ち込んだもの」だけで止め、前からあるものは main 側（Test の push・Nightly）で落とす。
import { test } from "node:test";
import assert from "node:assert/strict";
import { advisoriesAtOrAbove, formatAdvisory, judge } from "../scripts/lib/auditGate.mjs";

/** npm 7 以降の `npm audit --json` の形（必要なところだけ） */
const report = (/** @type {Array<[string, string, string]>} */ list) => ({
  auditReportVersion: 2,
  vulnerabilities: Object.fromEntries(
    list.map(([name, severity, ghsa]) => [
      name,
      { name, severity, via: [{ source: 1, name, title: `${name} の脆弱性`, url: `https://github.com/advisories/${ghsa}`, severity, range: "<9" }, "その他経由"] },
    ]),
  ),
});

test("advisoriesAtOrAbove: 指定より低い深刻度と、via が文字列（経由だけ）のものは数えない", () => {
  const r = report([["zod", "high", "GHSA-a"], ["qs", "moderate", "GHSA-b"], ["x", "critical", "GHSA-c"]]);
  assert.deepEqual([...advisoriesAtOrAbove(r, "high").values()].map((a) => a.name).sort(), ["x", "zod"]);
  assert.equal(advisoriesAtOrAbove(r, "moderate").size, 3);
  assert.equal(advisoriesAtOrAbove({ vulnerabilities: {} }, "high").size, 0);
});

test("advisoriesAtOrAbove: npm audit が失敗した結果（vulnerabilities が無い）は投げる（黙って通さない）", () => {
  assert.throws(() => advisoriesAtOrAbove({ error: { code: "ENOTFOUND" } }, "high"), /vulnerabilities/);
  assert.throws(() => advisoriesAtOrAbove(null, "high"), /vulnerabilities/);
  assert.throws(() => advisoriesAtOrAbove({ vulnerabilities: {} }, /** @type {any} */ ("severe")), /深刻度/);
});

test("judge: main にも前からあるもの（2026-10-24 の zod）は PR を止めない。PR が持ち込んだものだけ止める", () => {
  const base = advisoriesAtOrAbove(report([["zod", "high", "GHSA-zod"]]), "high");
  const head = advisoriesAtOrAbove(report([["zod", "high", "GHSA-zod"], ["evil", "critical", "GHSA-new"]]), "high");
  const { introduced, existing } = judge(head, base);
  assert.deepEqual(introduced.map((a) => a.name), ["evil"]);
  assert.deepEqual(existing.map((a) => a.name), ["zod"]);
});

test("judge: 基準が無い（main の push・Nightly・基準を読めない）ときは全部を止める", () => {
  const head = advisoriesAtOrAbove(report([["zod", "high", "GHSA-zod"]]), "high");
  assert.deepEqual(judge(head, null).introduced.map((a) => a.name), ["zod"]);
  assert.equal(judge(new Map(), null).introduced.length, 0);
});

test("formatAdvisory: 名前・深刻度・題・URL を1行で出す", () => {
  const [a] = advisoriesAtOrAbove(report([["zod", "high", "GHSA-zod"]]), "high").values();
  assert.equal(formatAdvisory(a), "zod（high・<9）zod の脆弱性 https://github.com/advisories/GHSA-zod");
});
