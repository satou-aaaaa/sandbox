import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveNinteiShinseishoRows, writeNinteiShinseishoDocx } from "../src/licenses/gijinkoku/documents/ninteiShinseisho.js";
import { resolveHenkoShinseishoRows, writeHenkoShinseishoDocx } from "../src/licenses/gijinkoku/documents/henkoShinseisho.js";
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

test("在留資格変更許可申請書: 現に有する在留資格・在留期限が反映される（入管法20条）", () => {
  const profile = buildSampleGijinkokuProfile();
  profile.currentStatusOfResidence = "留学";
  profile.currentZairyuKikanMatsuIso = "2027-03-31";
  const rows = resolveHenkoShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["現に有する在留資格"], "留学");
  assert.equal(map["現に有する在留資格の在留期限"], "2027-03-31");
  assert.equal(map["変更後の在留資格"], "技術・人文知識・国際業務");
});

test("在留資格変更許可申請書: 現に有する在留資格が未入力なら（未入力）と表示される", () => {
  const profile = buildSampleGijinkokuProfile();
  const rows = resolveHenkoShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["現に有する在留資格"], "（未入力）");
});

test("在留資格変更許可申請書: 認定証明書交付申請書と同じ学歴・報酬要件の項目を含む", () => {
  const profile = buildSampleGijinkokuProfile();
  const rows = resolveHenkoShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["提示年収"], "4,500,000円");
  assert.equal(map["従事する職務内容"], "自社開発システムのソフトウェア設計・プログラミング業務");
});

test("在留資格変更許可申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeHenkoShinseishoDocx, buildSampleGijinkokuProfile());
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
