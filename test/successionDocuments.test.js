import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveZaisanMokurokuRows, writeZaisanMokurokuDocx } from "../src/succession/documents/zaisanMokuroku.js";
import {
  resolveIsanBunkatsuKyogishoRows,
  writeIsanBunkatsuKyogishoDocx,
} from "../src/succession/documents/isanBunkatsuKyogisho.js";
import {
  checkIryuubunTarget,
  resolveExecutorClauseText,
  writeJihitsushoshoYuigonDocx,
} from "../src/succession/documents/jihitsushoshoYuigon.js";
import { calcLegalHeirs } from "../src/succession/heirs/calcLegalHeirs.js";
import { buildSampleSuccessionCase } from "../scripts/sampleSuccessionCase.js";

async function assertWrittenDocx(writeFn, ...args) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-succession-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(...args, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("財産目録: 行データを正しく組み立てる", () => {
  const c = buildSampleSuccessionCase();
  const rows = resolveZaisanMokurokuRows(c.properties);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], "不動産");
});

test("財産目録: docxファイルを生成できる", async () => {
  const c = buildSampleSuccessionCase();
  await assertWrittenDocx(writeZaisanMokurokuDocx, c.properties);
});

test("遺産分割協議書: 相続人・相続分・財産の行を組み立てる", () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const rows = resolveIsanBunkatsuKyogishoRows(heirsResult, c.properties);
  assert.ok(rows.some(([label]) => label.includes("法定相続人")));
  assert.ok(rows.some(([label]) => label.includes("財産:")));
});

test("遺産分割協議書: docxファイルを生成できる（争いなし）", async () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  await assertWrittenDocx(writeIsanBunkatsuKyogishoDocx, heirsResult, c.properties, c);
});

test("遺産分割協議書: hasDisputeAmongHeirs=trueの案件でもdocxファイルを生成できる（職域外警告付き）", async () => {
  const c = buildSampleSuccessionCase();
  c.hasDisputeAmongHeirs = true;
  const heirsResult = calcLegalHeirs(c.familyStructure);
  await assertWrittenDocx(writeIsanBunkatsuKyogishoDocx, heirsResult, c.properties, c);
});

test("checkIryuubunTarget: 評価額が未入力の財産があれば計算不能の警告を返す", () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const properties = [{ itemId: "p1", category: "不動産", description: "評価額未入力の土地" }];
  const warnings = checkIryuubunTarget(heirsResult, properties);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /評価額が未入力/);
});

test("checkIryuubunTarget: 遺留分を下回る割当てがあれば警告する", () => {
  const heirsResult = calcLegalHeirs({
    caseId: "c1",
    decedentDeathDateIso: "2026-01-01",
    hasSpouse: false,
    children: [
      { personId: "child-1", isAlive: true },
      { personId: "child-2", isAlive: true },
    ],
    ascendants: [],
    siblings: [],
  });
  // 子2人・配偶者なし → 各1/2。遺留分は各自の法定相続分×1/2 = 各1/4。
  // 総額1000万円のうち、child-1に100万円しか割り当てないのは遺留分(250万円)を下回る。
  const properties = [
    { itemId: "p1", category: "預貯金", description: "口座1", estimatedValueYen: 1_000_000, assignedHeirPersonId: "child-1" },
    { itemId: "p2", category: "預貯金", description: "口座2", estimatedValueYen: 9_000_000, assignedHeirPersonId: "child-2" },
  ];
  const warnings = checkIryuubunTarget(heirsResult, properties);
  assert.ok(warnings.some((w) => w.includes("child-1") || w.includes("遺留分の目安")));
});

test("checkIryuubunTarget: 兄弟姉妹には遺留分が無いため警告対象にならない（民法1042条）", () => {
  const heirsResult = calcLegalHeirs({
    caseId: "c1",
    decedentDeathDateIso: "2026-01-01",
    hasSpouse: false,
    children: [],
    ascendants: [],
    siblings: [{ personId: "sibling-1", isAlive: true, siblingBloodType: "full" }],
  });
  // 全財産をsibling-1に割り当てず(assignedHeirPersonId未設定)、遺留分自体が
  // 無いため警告は出ないことを確認する。
  const zeroAssigned = [{ itemId: "p1", category: "預貯金", description: "口座1", estimatedValueYen: 10_000_000 }];
  const warnings = checkIryuubunTarget(heirsResult, zeroAssigned);
  assert.deepEqual(warnings, []);
});

test("自筆証書遺言: docxファイルを生成できる", async () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  await assertWrittenDocx(writeJihitsushoshoYuigonDocx, heirsResult, c.properties);
});

test("resolveExecutorClauseText: executorName未指定ならnullを返す（後方互換）", () => {
  assert.equal(resolveExecutorClauseText(), null);
  assert.equal(resolveExecutorClauseText({}), null);
});

test("resolveExecutorClauseText: executorNameを指定すると遺言執行者の指定条項の文面を返す（民法1006条1項）", () => {
  const text = resolveExecutorClauseText({ executorName: "サンプル 太郎" });
  assert.match(text, /遺言執行者として次の者を指定する/);
  assert.match(text, /サンプル 太郎/);
});

test("自筆証書遺言: executorNameを指定してもdocxファイルを生成できる", async () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-succession-test-executor-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeJihitsushoshoYuigonDocx(heirsResult, c.properties, outPath, { executorName: "サンプル 太郎" });
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
});
