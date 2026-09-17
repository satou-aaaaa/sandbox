import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveDaihyoShainGosenshoRows, writeDaihyoShainGosenshoDocx } from "../src/incorporation/documents/daihyoShainGosensho.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "../scripts/sampleIncorporationCase.js";

async function assertWrittenDocx(writeFn, teikan) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-incorporation-daihyoshain-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(teikan, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("resolveDaihyoShainGosenshoRows: 合同会社は正常に行データを生成できる（会社法599条3項）", () => {
  const teikan = buildSampleGodoKaishaCase().teikan;
  const rows = resolveDaihyoShainGosenshoRows(teikan);
  const map = Object.fromEntries(rows);
  assert.equal(map["商号"], "サンプル工房合同会社");
  assert.equal(map["社員（互選に加わった者）"], "サンプル花子");
  assert.equal(map["互選により定めた代表社員"], "サンプル花子");
});

test("resolveDaihyoShainGosenshoRows: isDaihyoShainの社員が誰もいなければ「（未選出）」と表示される", () => {
  const teikan = buildSampleGodoKaishaCase().teikan;
  teikan.founders = teikan.founders.map((f) => ({ ...f, isDaihyoShain: false }));
  const rows = resolveDaihyoShainGosenshoRows(teikan);
  const map = Object.fromEntries(rows);
  assert.equal(map["互選により定めた代表社員"], "（未選出）");
});

test("resolveDaihyoShainGosenshoRows: 株式会社の場合はエラーになる（代表社員の互選書は合同会社のみ対象。呼び出しミス防止）", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  assert.throws(() => resolveDaihyoShainGosenshoRows(teikan), /合同会社/);
});

test("代表社員の互選書: 合同会社のdocxファイルを生成できる", async () => {
  await assertWrittenDocx(writeDaihyoShainGosenshoDocx, buildSampleGodoKaishaCase().teikan);
});

test("代表社員の互選書: 株式会社の場合はdocx生成もエラーになる", async () => {
  await assert.rejects(() => writeDaihyoShainGosenshoDocx(buildSampleKabushikiKaishaCase().teikan, "/tmp/unused.docx"), /合同会社/);
});
