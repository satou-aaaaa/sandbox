import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { loadCases, upsertCase, removeCase } from "../src/succession/caseStore.js";
import { buildSampleSuccessionCase } from "../scripts/sampleSuccessionCase.js";

/** @returns {string} テスト専用の一時ファイルパス */
function tmpFile(name) {
  return path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-succession-test-${name}-${Date.now()}-${Math.random()}.json`);
}

test("loadCases: ファイルが存在しない場合は空配列を返す", async () => {
  const cases = await loadCases(tmpFile("no-such-cases"));
  assert.deepEqual(cases, []);
});

test("upsertCase: 保存時にfamilyStructureからlastCalculatedResultが自動計算される", async () => {
  const filePath = tmpFile("cases");
  try {
    const c = buildSampleSuccessionCase();
    await upsertCase(c, filePath);
    const cases = await loadCases(filePath);
    assert.equal(cases.length, 1);
    assert.ok(cases[0].lastCalculatedResult);
    assert.equal(cases[0].lastCalculatedResult.pattern, "配偶者と子");
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test("upsertCase: familyStructure変更後の更新でlastCalculatedResultが再計算される", async () => {
  const filePath = tmpFile("cases-recalc");
  try {
    const c = buildSampleSuccessionCase();
    await upsertCase(c, filePath);

    const updated = { ...c, familyStructure: { ...c.familyStructure, hasSpouse: false } };
    await upsertCase(updated, filePath);
    const cases = await loadCases(filePath);
    assert.equal(cases.length, 1);
    assert.equal(cases[0].lastCalculatedResult.pattern, "子のみ");
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test("upsertCase・removeCase: 複数案件の追加・削除ができる", async () => {
  const filePath = tmpFile("cases-multi");
  try {
    const c1 = buildSampleSuccessionCase();
    const c2 = { ...buildSampleSuccessionCase(), caseId: "case-souzoku-002" };
    await upsertCase(c1, filePath);
    await upsertCase(c2, filePath);
    const afterAdd = await loadCases(filePath);
    assert.equal(afterAdd.length, 2);

    const afterRemove = await removeCase(c1.caseId, filePath);
    assert.equal(afterRemove.length, 1);
    assert.equal(afterRemove[0].caseId, c2.caseId);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test("loadCases: 配列でないJSONを読み込むとエラーになる", async () => {
  const filePath = tmpFile("invalid-cases");
  try {
    await fs.writeFile(filePath, JSON.stringify({ not: "an array" }), "utf8");
    await assert.rejects(() => loadCases(filePath), /配列ではありません/);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});
