import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  loadPartners,
  upsertPartner,
  loadCases,
  upsertCase,
  removeCase,
} from "../src/portal/caseStore.js";

/** @returns {string} テスト専用の一時ファイルパス */
function tmpFile(name) {
  return path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-portal-test-${name}-${Date.now()}-${Math.random()}.json`);
}

test("loadPartners: ファイルが存在しない場合は空配列を返す", async () => {
  const partners = await loadPartners(tmpFile("no-such-partners"));
  assert.deepEqual(partners, []);
});

test("upsertPartner: 新規登録・同じpartnerIdでの上書き更新ができる", async () => {
  const filePath = tmpFile("partners");
  try {
    await upsertPartner({ partnerId: "office-a", partnerName: "A事務所" }, filePath);
    const after1 = await loadPartners(filePath);
    assert.equal(after1.length, 1);
    assert.equal(after1[0].partnerName, "A事務所");

    await upsertPartner({ partnerId: "office-a", partnerName: "A事務所（改称）" }, filePath);
    const after2 = await loadPartners(filePath);
    assert.equal(after2.length, 1);
    assert.equal(after2[0].partnerName, "A事務所（改称）");
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test("upsertCase・removeCase: 案件の追加・上書き・削除ができる", async () => {
  const filePath = tmpFile("cases");
  try {
    await upsertCase(
      { caseId: "c1", partnerId: "office-a", caseName: "案件1", receivedDateIso: "2026-01-01", dueDateIso: "2026-02-01", feeAmount: 10000, status: "受付" },
      filePath
    );
    await upsertCase(
      { caseId: "c2", partnerId: "office-a", caseName: "案件2", receivedDateIso: "2026-01-05", dueDateIso: "2026-02-10", feeAmount: 20000, status: "受付" },
      filePath
    );
    const afterAdd = await loadCases(filePath);
    assert.equal(afterAdd.length, 2);

    await upsertCase(
      { caseId: "c1", partnerId: "office-a", caseName: "案件1（更新）", receivedDateIso: "2026-01-01", dueDateIso: "2026-02-01", feeAmount: 10000, status: "作業中" },
      filePath
    );
    const afterUpdate = await loadCases(filePath);
    assert.equal(afterUpdate.length, 2);
    const updated = afterUpdate.find((c) => c.caseId === "c1");
    assert.equal(updated.status, "作業中");
    assert.equal(updated.caseName, "案件1（更新）");

    const afterRemove = await removeCase("c1", filePath);
    assert.equal(afterRemove.length, 1);
    assert.equal(afterRemove[0].caseId, "c2");
  } finally {
    await fs.rm(filePath, { force: true });
  }
});

test("loadPartners: 配列でないJSONを読み込むとエラーになる", async () => {
  const filePath = tmpFile("invalid-partners");
  try {
    await fs.writeFile(filePath, JSON.stringify({ not: "an array" }), "utf8");
    await assert.rejects(() => loadPartners(filePath), /配列ではありません/);
  } finally {
    await fs.rm(filePath, { force: true });
  }
});
