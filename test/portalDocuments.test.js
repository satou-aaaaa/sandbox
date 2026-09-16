import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveMitsumorishoRows, writeMitsumorishoDocx } from "../src/portal/documents/mitsumorisho.js";
import { resolveSeikyushoRows, writeSeikyushoDocx } from "../src/portal/documents/seikyusho.js";
import { buildSamplePartner, buildSampleCase } from "../scripts/samplePortalData.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, caseRecord, partner) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-portal-doc-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(caseRecord, partner, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("見積書: 案件・元請の情報が反映される", () => {
  const rows = resolveMitsumorishoRows(buildSampleCase(), buildSamplePartner());
  const map = Object.fromEntries(rows);
  assert.equal(map["宛先"], "サンプル行政書士法人");
  assert.equal(map["報酬額（税別）"], "80,000円");
  assert.equal(map["納期"], "2026-10-15");
});

test("見積書: 元請情報が未指定でも（未入力）と表示される", () => {
  const rows = resolveMitsumorishoRows(buildSampleCase(), undefined);
  const map = Object.fromEntries(rows);
  assert.equal(map["宛先"], "（未入力）");
});

test("見積書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeMitsumorishoDocx, buildSampleCase(), buildSamplePartner());
});

test("請求書: 案件・元請の情報が反映される", () => {
  const rows = resolveSeikyushoRows(buildSampleCase(), buildSamplePartner());
  const map = Object.fromEntries(rows);
  assert.equal(map["請求先"], "サンプル行政書士法人");
  assert.equal(map["請求額（税別）"], "80,000円");
  assert.equal(map["受注日"], "2026-09-01");
});

test("請求書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeSeikyushoDocx, buildSampleCase(), buildSamplePartner());
});
