import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveShinseishoRows, writeShinseishoDocx } from "../src/licenses/sanpai/documents/shinseisho.js";
import { resolveVehicleRows, writeJigyokeikakushoDocx } from "../src/licenses/sanpai/documents/jigyokeikakusho.js";
import { buildSampleSanpaiProfile } from "../scripts/sampleSanpaiProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, profile) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-sanpai-test-${Date.now()}-${Math.random()}.docx`);
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
  const profile = buildSampleSanpaiProfile();
  profile.representativeName = undefined;
  profile.prefecture = undefined;
  const rows = resolveShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["代表者氏名"], "（未入力）");
  assert.equal(map["活動予定の都道府県"], "（未入力）");
});

test("許可申請書: 取り扱う産業廃棄物の種類は複数の場合まとめて表示する", () => {
  const profile = buildSampleSanpaiProfile();
  const rows = resolveShinseishoRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["取り扱う産業廃棄物の種類"], "がれき類、木くず");
});

test("許可申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeShinseishoDocx, buildSampleSanpaiProfile());
});

test("事業計画書: 運搬車両の一覧を防止措置の有無つきで解決できる", () => {
  const profile = buildSampleSanpaiProfile();
  profile.vehicles.push({ vehicleType: "軽トラック", plateNumber: "名古屋500 う 90-12", hasSpillPreventionMeasures: false });
  const rows = resolveVehicleRows(profile.vehicles);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], ["軽トラック", "名古屋500 う 90-12", "要確認"]);
});

test("事業計画書: 車両一覧が空でもdocxファイルを生成できる", async () => {
  const profile = buildSampleSanpaiProfile();
  profile.vehicles = [];
  await assertWrittenDocx(writeJigyokeikakushoDocx, profile);
});

test("事業計画書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeJigyokeikakushoDocx, buildSampleSanpaiProfile());
});
