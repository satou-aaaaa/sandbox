import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveHokininKetteishoRows, writeHokininKetteishoDocx } from "../src/incorporation/documents/hokininKetteisho.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "../scripts/sampleIncorporationCase.js";

async function assertWrittenDocx(writeFn, teikan, decisions) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-incorporation-hokinin-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(teikan, decisions, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

const SAMPLE_DECISIONS = { honTenShozaiChi: "東京都サンプル区1丁目2番3号", daihyoTorishimariyaku: "サンプル太郎" };

test("resolveHokininKetteishoRows: 株式会社は正常に行データを生成できる", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  const rows = resolveHokininKetteishoRows(teikan, SAMPLE_DECISIONS);
  const map = Object.fromEntries(rows);
  assert.equal(map["設立時代表取締役"], "サンプル太郎");
  assert.equal(map["本店の具体的所在場所"], "東京都サンプル区1丁目2番3号");
});

test("resolveHokininKetteishoRows: 決定事項が未入力なら（未入力）と表示される", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  const rows = resolveHokininKetteishoRows(teikan, {});
  const map = Object.fromEntries(rows);
  assert.equal(map["本店の具体的所在場所"], "（未入力）");
});

test("resolveHokininKetteishoRows: 合同会社の場合はエラーになる（発起人決定書は株式会社のみ対象。呼び出しミス防止）", () => {
  const teikan = buildSampleGodoKaishaCase().teikan;
  assert.throws(() => resolveHokininKetteishoRows(teikan, SAMPLE_DECISIONS), /株式会社/);
});

test("発起人決定書: 株式会社のdocxファイルを生成できる", async () => {
  await assertWrittenDocx(writeHokininKetteishoDocx, buildSampleKabushikiKaishaCase().teikan, SAMPLE_DECISIONS);
});

test("発起人決定書: 合同会社の場合はdocx生成もエラーになる", async () => {
  await assert.rejects(() => writeHokininKetteishoDocx(buildSampleGodoKaishaCase().teikan, SAMPLE_DECISIONS, "/tmp/unused.docx"), /株式会社/);
});
