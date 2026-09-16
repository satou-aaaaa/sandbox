import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveShinseishoRows, writeShinseishoDocx } from "../src/licenses/nouchi-tenyo/documents/shinseisho.js";
import { resolveShikinChotatsuRows, writeJigyokeikakushoDocx } from "../src/licenses/nouchi-tenyo/documents/jigyokeikakusho.js";
import { buildSampleNouchiTenyoProfile } from "../scripts/sampleNouchiTenyoProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, profile) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-nouchi-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(profile, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("許可申請書: 4条の場合は譲受人欄が出力されない", () => {
  const rows = resolveShinseishoRows(buildSampleNouchiTenyoProfile());
  const map = Object.fromEntries(rows);
  assert.equal(map["譲受人・借主氏名"], undefined);
});

test("許可申請書: 5条の場合は譲受人欄が出力される", () => {
  const profile = buildSampleNouchiTenyoProfile();
  profile.article = "5条";
  profile.rightsHolderName = "サンプル譲受人";
  const rows = resolveShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["譲受人・借主氏名"], "サンプル譲受人");
});

test("許可申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeShinseishoDocx, buildSampleNouchiTenyoProfile());
});

test("事業計画書: 資金調達内訳を表形式に解決できる", () => {
  const rows = resolveShikinChotatsuRows(buildSampleNouchiTenyoProfile().shikinChotatsu);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ["自己資金", "3,000,000円", "（未入力）"]);
});

test("事業計画書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeJigyokeikakushoDocx, buildSampleNouchiTenyoProfile());
});
