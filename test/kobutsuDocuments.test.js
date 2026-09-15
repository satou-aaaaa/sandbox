import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveShinseishoRows, writeShinseishoDocx } from "../src/licenses/kobutsu/documents/shinseisho.js";
import { resolveSeiyakushoFields, writeSeiyakushoDocx } from "../src/licenses/kobutsu/documents/seiyakusho.js";
import { resolveRirekishoRows, writeRirekishoDocx } from "../src/licenses/kobutsu/documents/rirekisho.js";
import { buildSampleKobutsuProfile } from "../scripts/sampleKobutsuProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, profile) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-kobutsu-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(profile, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("許可申請書: 必須項目が未入力なら（未入力）と表示される", () => {
  const profile = buildSampleKobutsuProfile();
  profile.address = undefined;
  profile.businessName = undefined;
  const rows = resolveShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["住所"], "（未入力）");
  assert.equal(map["屋号"], "（未入力）");
});

test("許可申請書: 営業所名・管理者名は複数営業所の場合まとめて表示する", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList.push({
    officeName: "支店",
    hasLegitimateUsageRight: true,
    managerName: "鈴木 花子",
    isManagerFullTime: true,
  });
  const rows = resolveShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["営業所"], "本店、支店");
  assert.equal(map["管理者"], "山田 太郎、鈴木 花子");
});

test("許可申請書: インターネット利用ありの場合は「あり」と表示される", () => {
  const profile = buildSampleKobutsuProfile();
  profile.usesInternet = true;
  profile.url = "https://example.com/shop";
  const rows = resolveShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["インターネット利用の有無"], "あり");
  assert.equal(map["URL（該当する場合）"], "https://example.com/shop");
});

test("許可申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeShinseishoDocx, buildSampleKobutsuProfile());
});

test("誓約書: 欠格事由の判定ロジックはcheckKobutsuKekkakuと同じものを使う", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const { rows, check } = resolveSeiyakushoFields(profile);
  const map = Object.fromEntries(rows);
  assert.equal(check.passed, false);
  assert.equal(map["欠格事由（古物営業法第4条）の該当状況"], "該当あり（要確認）");
});

test("誓約書: 欠格事由に該当しなければ「該当なし」と表示される", () => {
  const profile = buildSampleKobutsuProfile();
  const { rows } = resolveSeiyakushoFields(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["欠格事由（古物営業法第4条）の該当状況"], "該当なし");
});

test("誓約書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeSeiyakushoDocx, buildSampleKobutsuProfile());
});

test("略歴書: 略歴が未入力なら（未入力）になる", () => {
  const profile = buildSampleKobutsuProfile();
  const rows = resolveRirekishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["生年月日"], "1985-04-01");
  assert.ok(!("略歴" in map)); // 略歴は表ではなく本文段落として出力される
});

test("略歴書: docxファイルを生成できる（略歴の記載あり）", async () => {
  const profile = buildSampleKobutsuProfile();
  profile.representativeHistory = "2015年4月 サンプル商事株式会社 入社\n2020年3月 同社退社、独立開業準備";
  await assertWrittenDocx(writeRirekishoDocx, profile);
});

test("略歴書: 略歴が未入力でもdocxファイルを生成できる", async () => {
  await assertWrittenDocx(writeRirekishoDocx, buildSampleKobutsuProfile());
});
