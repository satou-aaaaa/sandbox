import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveTodokedeshoRows, writeTodokedeshoDocx } from "../src/licenses/minpaku/documents/todokedesho.js";
import { resolveSeiyakushoFields, writeSeiyakushoDocx } from "../src/licenses/minpaku/documents/seiyakusho.js";
import { resolveChecklistFields, writeChecklistDocx } from "../src/licenses/minpaku/documents/checklist.js";
import { buildSampleMinpakuProfile } from "../scripts/sampleMinpakuProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, arg) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-minpaku-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(arg, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("届出書: 必須項目が未入力なら（未入力）と表示される", () => {
  const profile = buildSampleMinpakuProfile();
  profile.managementCompanyName = undefined;
  const rows = resolveTodokedeshoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["住宅宿泊管理業者"], "（未入力）");
});

test("届出書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeTodokedeshoDocx, buildSampleMinpakuProfile());
});

test("誓約書: 欠格事由の判定ロジックはcheckMinpakuKekkakuと同じものを使う", () => {
  const profile = buildSampleMinpakuProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const { rows, check } = resolveSeiyakushoFields(profile);
  const map = Object.fromEntries(rows);
  assert.equal(check.passed, false);
  assert.equal(map["欠格事由（住宅宿泊事業法第4条）の該当状況"], "該当あり（要確認）");
});

test("誓約書: 欠格事由に該当しなければ「該当なし」と表示される", () => {
  const profile = buildSampleMinpakuProfile();
  const { rows } = resolveSeiyakushoFields(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["欠格事由（住宅宿泊事業法第4条）の該当状況"], "該当なし");
});

test("誓約書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeSeiyakushoDocx, buildSampleMinpakuProfile());
});

test("必要書類チェックリスト: 取得済み・未取得の書類名を分けて解決できる", () => {
  const profile = buildSampleMinpakuProfile();
  profile.requiredDocuments[0].obtained = false;
  const { obtainedLabels, missingLabels } = resolveChecklistFields(profile.requiredDocuments);
  assert.equal(missingLabels.length, 1);
  assert.equal(obtainedLabels.length, profile.requiredDocuments.length - 1);
});

test("必要書類チェックリスト: docxファイルを生成できる（未取得の書類あり）", async () => {
  const profile = buildSampleMinpakuProfile();
  profile.requiredDocuments[0].obtained = false;
  await assertWrittenDocx(writeChecklistDocx, profile.requiredDocuments);
});

test("必要書類チェックリスト: docxファイルを生成できる（すべて取得済み）", async () => {
  await assertWrittenDocx(writeChecklistDocx, buildSampleMinpakuProfile().requiredDocuments);
});
