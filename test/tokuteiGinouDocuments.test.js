import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveNinteiShinseishoRows, writeNinteiShinseishoDocx } from "../src/licenses/tokutei-ginou/documents/ninteiShinseisho.js";
import { resolveHenkoShinseishoRows, writeHenkoShinseishoDocx } from "../src/licenses/tokutei-ginou/documents/henkoShinseisho.js";
import { resolveShienKeikakushoRows, writeShienKeikakushoDocx } from "../src/licenses/tokutei-ginou/documents/shienKeikakusho.js";
import { resolveChecklistDocuments, writeChecklistDocx } from "../src/licenses/tokutei-ginou/documents/checklist.js";
import { clearFields } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";
import { seedFieldRegistry } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.seed.js";
import { buildSampleTokuteiGinouProfile } from "../scripts/sampleTokuteiGinouProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, arg) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-tokutei-ginou-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(arg, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("認定証明書交付申請書: 分野ラベルを含む行データを組み立てる", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  const rows = resolveNinteiShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["特定産業分野"], "外食業");
});

test("認定証明書交付申請書: 必須項目が未入力なら（未入力）と表示される", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.nationality = undefined;
  const rows = resolveNinteiShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["国籍"], "（未入力）");
});

test("認定証明書交付申請書: docxファイルを生成できる", async () => {
  clearFields();
  seedFieldRegistry();
  await assertWrittenDocx(writeNinteiShinseishoDocx, buildSampleTokuteiGinouProfile());
});

test("在留資格変更許可申請書: 現に有する在留資格・在留期限が反映される（入管法20条）", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  profile.currentStatusOfResidence = "技能実習";
  profile.currentZairyuKikanMatsuIso = "2027-03-31";
  const rows = resolveHenkoShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["現に有する在留資格"], "技能実習");
  assert.equal(map["現に有する在留資格の在留期限"], "2027-03-31");
  assert.equal(map["変更後の在留資格"], "特定技能1号");
});

test("在留資格変更許可申請書: 現に有する在留資格が未入力なら（未入力）と表示される", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  const rows = resolveHenkoShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["現に有する在留資格"], "（未入力）");
});

test("在留資格変更許可申請書: 認定証明書交付申請書と同じ技能水準・報酬要件の項目を含む", () => {
  clearFields();
  seedFieldRegistry();
  const profile = buildSampleTokuteiGinouProfile();
  const rows = resolveHenkoShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["特定産業分野"], "外食業");
  assert.equal(map["支援計画の実施方法"], "自社実施");
});

test("在留資格変更許可申請書: docxファイルを生成できる", async () => {
  clearFields();
  seedFieldRegistry();
  await assertWrittenDocx(writeHenkoShinseishoDocx, buildSampleTokuteiGinouProfile());
});

test("支援計画書: 義務的支援10項目のカバー状況を含む行データを組み立てる", () => {
  const profile = buildSampleTokuteiGinouProfile();
  const rows = resolveShienKeikakushoRows(profile.shienTaisei);
  const map = Object.fromEntries(rows);
  assert.equal(map["支援計画の実施方法"], "自社実施");
});

test("支援計画書: docxファイルを生成できる", async () => {
  const profile = buildSampleTokuteiGinouProfile();
  await assertWrittenDocx(writeShienKeikakushoDocx, profile.shienTaisei);
});

test("添付書類チェックリスト: 分野固有の日本語試験が必要な分野（介護）では追加書類を含む", () => {
  clearFields();
  seedFieldRegistry();
  const documents = resolveChecklistDocuments("kaigo");
  assert.ok(documents.some((d) => d.includes("介護")));
});

test("添付書類チェックリスト: 分野固有の日本語試験が不要な分野では追加書類を含まない", () => {
  clearFields();
  seedFieldRegistry();
  const documents = resolveChecklistDocuments("gaishokugyou");
  assert.ok(!documents.some((d) => d.includes("分野固有の日本語試験")));
});

test("添付書類チェックリスト: 未登録の分野キーでも共通書類のみ返す", () => {
  clearFields();
  const documents = resolveChecklistDocuments("unknown-field");
  assert.ok(documents.length > 0);
});

test("添付書類チェックリスト: docxファイルを生成できる（分野確定済み）", async () => {
  clearFields();
  seedFieldRegistry();
  await assertWrittenDocx(writeChecklistDocx, "gaishokugyou");
});

test("添付書類チェックリスト: docxファイルを生成できる（分野未確定）", async () => {
  clearFields();
  await assertWrittenDocx(writeChecklistDocx, "unknown-field");
});
