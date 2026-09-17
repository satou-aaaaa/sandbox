import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  resolveDecedentRows,
  resolveHeirRows,
  writeHouteiSouzokuJohoIchiranzuDocx,
} from "../src/succession/documents/houteiSouzokuJohoIchiranzu.js";
import { calcLegalHeirs } from "../src/succession/heirs/calcLegalHeirs.js";
import { buildSampleSuccessionCase } from "../scripts/sampleSuccessionCase.js";

test("resolveDecedentRows: 被相続人の氏名・生年月日・最後の住所・死亡年月日を組み立てる（不動産登記規則247条1項1号）", () => {
  const c = buildSampleSuccessionCase();
  const rows = resolveDecedentRows(c.familyStructure);
  const map = Object.fromEntries(rows);
  assert.equal(map["氏名"], "サンプル 太郎");
  assert.equal(map["生年月日"], "1950-04-01");
  assert.equal(map["最後の住所"], "サンプル県サンプル市1-2-3");
  assert.equal(map["死亡の年月日"], "2026-06-01");
});

test("resolveDecedentRows: 未入力項目は（未入力）と表示される", () => {
  const c = buildSampleSuccessionCase();
  delete c.familyStructure.decedentName;
  const rows = resolveDecedentRows(c.familyStructure);
  const map = Object.fromEntries(rows);
  assert.equal(map["氏名"], "（未入力）");
});

test("resolveHeirRows: 相続人ごとに氏名・生年月日・続柄（大分類）を組み立てる（不動産登記規則247条1項2号）", () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const rows = resolveHeirRows(c.familyStructure, heirsResult);
  // サンプルは配偶者+子2人
  assert.equal(rows.length, 3);
  const spouseRow = rows.find((r) => r[2] === "配偶者");
  assert.ok(spouseRow);
  const childRow = rows.find((r) => r[0] === "長男");
  assert.ok(childRow);
  assert.equal(childRow[1], "1975-08-10");
  assert.equal(childRow[2], "子（代襲相続人を含む）");
});

test("resolveHeirRows: 生年月日が未入力の相続人は（未入力）と表示される", () => {
  const c = buildSampleSuccessionCase();
  c.familyStructure.children[0].birthDate = undefined;
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const rows = resolveHeirRows(c.familyStructure, heirsResult);
  const childRow = rows.find((r) => r[0] === "長男");
  assert.equal(childRow[1], "（未入力）");
});

test("resolveHeirRows: 直系尊属のみのケースで続柄が「直系尊属」になる", () => {
  const c = buildSampleSuccessionCase();
  c.familyStructure.hasSpouse = false;
  c.familyStructure.children = [];
  c.familyStructure.ascendants = [{ personId: "father", label: "父", isAlive: true, ascendantDegree: 1, birthDate: "1945-01-01" }];
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const rows = resolveHeirRows(c.familyStructure, heirsResult);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][2], "直系尊属");
});

test("法定相続情報一覧図: docxファイルを生成できる", async () => {
  const c = buildSampleSuccessionCase();
  const heirsResult = calcLegalHeirs(c.familyStructure);
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-succession-ichiranzu-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeHouteiSouzokuJohoIchiranzuDocx(c.familyStructure, heirsResult, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
});
