import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveNinteiShinseishoRows, writeNinteiShinseishoDocx } from "../src/licenses/gijinkoku/documents/ninteiShinseisho.js";
import { resolveChecklistDocuments, writeChecklistDocx } from "../src/licenses/gijinkoku/documents/checklist.js";
import { buildSampleGijinkokuProfile } from "../scripts/sampleGijinkokuProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, arg) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-gijinkoku-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(arg, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("認定証明書交付申請書: 必須項目が未入力なら（未入力）と表示される", () => {
  const profile = buildSampleGijinkokuProfile();
  profile.nationality = undefined;
  const rows = resolveNinteiShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["国籍"], "（未入力）");
});

test("認定証明書交付申請書: 所属機関カテゴリー未確定なら「（未確定）」と表示される", () => {
  const profile = buildSampleGijinkokuProfile();
  profile.companyCategory = undefined;
  const rows = resolveNinteiShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["所属機関カテゴリー"], "（未確定）");
});

test("認定証明書交付申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeNinteiShinseishoDocx, buildSampleGijinkokuProfile());
});

test("添付書類チェックリスト: カテゴリーごとに異なる書類一覧を返す", () => {
  assert.notDeepEqual(resolveChecklistDocuments(1), resolveChecklistDocuments(4));
  assert.ok(resolveChecklistDocuments(2).length > 0);
});

test("添付書類チェックリスト: カテゴリー未確定なら空配列を返す", () => {
  assert.deepEqual(resolveChecklistDocuments(undefined), []);
});

test("添付書類チェックリスト: docxファイルを生成できる（カテゴリー確定済み）", async () => {
  await assertWrittenDocx(writeChecklistDocx, 2);
});

test("添付書類チェックリスト: docxファイルを生成できる（カテゴリー未確定）", async () => {
  await assertWrittenDocx(writeChecklistDocx, undefined);
});
