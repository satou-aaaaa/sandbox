import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { loadCases, upsertCase, removeCase } from "../src/incorporation/caseStore.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "../scripts/sampleIncorporationCase.js";

/** @returns {string} テスト専用の一時ファイルパス */
function tmpFile(name) {
  return path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-incorporation-test-${name}-${Date.now()}-${Math.random()}.json`);
}

test("loadCases: ファイルが存在しない場合は空配列を返す", async () => {
  const cases = await loadCases(tmpFile("no-such-cases"));
  assert.deepEqual(cases, []);
});

test("upsertCase・removeCase: 案件の追加・上書き・削除ができる", async () => {
  const filePath = tmpFile("cases");
  try {
    const c1 = buildSampleKabushikiKaishaCase();
    const c2 = buildSampleGodoKaishaCase();
    await upsertCase(c1, filePath);
    await upsertCase(c2, filePath);
    const afterAdd = await loadCases(filePath);
    assert.equal(afterAdd.length, 2);

    const updated = { ...c1, status: /** @type {const} */ ("認証待ち") };
    await upsertCase(updated, filePath);
    const afterUpdate = await loadCases(filePath);
    assert.equal(afterUpdate.length, 2);
    const found = afterUpdate.find((c) => c.caseId === c1.caseId);
    assert.equal(found.status, "認証待ち");

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
