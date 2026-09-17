import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  filterCompletedCasesForMonth,
  resolveMonthlySeikyushoTable,
  writeMonthlySeikyushoDocx,
} from "../src/portal/documents/monthlySeikyusho.js";
import { buildSamplePartner, buildSampleCases } from "../scripts/samplePortalData.js";

test("filterCompletedCasesForMonth: 対象パートナー・対象年月かつ完了ステータスの案件のみ抽出する", () => {
  const cases = buildSampleCases();
  const result = filterCompletedCasesForMonth(cases, "sample-law-office", "2026-09");
  assert.equal(result.length, 2);
  assert.ok(result.every((c) => c.status === "完了"));
  assert.ok(result.every((c) => c.completedDateIso.startsWith("2026-09")));
});

test("filterCompletedCasesForMonth: 作業中（未完了）の案件は含まれない", () => {
  const cases = buildSampleCases();
  const result = filterCompletedCasesForMonth(cases, "sample-law-office", "2026-09");
  assert.ok(!result.some((c) => c.caseId === "case-003"));
});

test("filterCompletedCasesForMonth: 完了日が対象月と異なる案件は含まれない", () => {
  const cases = buildSampleCases();
  const result = filterCompletedCasesForMonth(cases, "sample-law-office", "2026-10");
  assert.equal(result.length, 0);
});

test("filterCompletedCasesForMonth: 別のpartnerIdの案件は含まれない", () => {
  const cases = buildSampleCases();
  const result = filterCompletedCasesForMonth(cases, "other-partner", "2026-09");
  assert.equal(result.length, 0);
});

test("resolveMonthlySeikyushoTable: 報酬額の合計が正しく計算される", () => {
  const cases = filterCompletedCasesForMonth(buildSampleCases(), "sample-law-office", "2026-09");
  const { rows, totalFeeAmount } = resolveMonthlySeikyushoTable(cases);
  assert.equal(rows.length, 2);
  assert.equal(totalFeeAmount, 80000 + 50000);
});

test("resolveMonthlySeikyushoTable: 該当案件が0件でも合計0円で計算できる", () => {
  const { rows, totalFeeAmount } = resolveMonthlySeikyushoTable([]);
  assert.equal(rows.length, 0);
  assert.equal(totalFeeAmount, 0);
});

test("月次請求サマリー: docxファイルを生成できる（該当案件あり）", async () => {
  const cases = filterCompletedCasesForMonth(buildSampleCases(), "sample-law-office", "2026-09");
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-portal-monthly-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeMonthlySeikyushoDocx(cases, buildSamplePartner(), "2026-09", outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
});

test("月次請求サマリー: 該当案件が0件でもdocxファイルを生成できる（確認事項の注記付き）", async () => {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-portal-monthly-empty-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeMonthlySeikyushoDocx([], buildSamplePartner(), "2026-11", outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
});
