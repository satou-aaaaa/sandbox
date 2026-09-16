import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveShinseishoSummaryRows, writeShinseishoSummaryDocx } from "../src/licenses/inshokuten-eigyo/documents/shinseishoSummary.js";
import { resolveTenpuDocuments, writeTenpuChecklistDocx } from "../src/licenses/inshokuten-eigyo/documents/tenpuChecklist.js";
import { buildSampleInshokutenEigyoProfile } from "../scripts/sampleInshokutenEigyoProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, arg) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-inshokuten-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(arg, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("営業許可申請書サマリー: 必須項目が未入力なら（未入力）と表示される", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  profile.businessName = undefined;
  const rows = resolveShinseishoSummaryRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["屋号"], "（未入力）");
});

test("営業許可申請書サマリー: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeShinseishoSummaryDocx, buildSampleInshokutenEigyoProfile());
});

test("添付書類チェックリスト: 貯水槽水・井戸水を使用しない場合は水質検査成績書を含まない", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.usesTankOrWellWater = false;
  const documents = resolveTenpuDocuments(shisetsu);
  assert.ok(!documents.some((d) => d.includes("水質検査")));
});

test("添付書類チェックリスト: 貯水槽水・井戸水を使用する場合は水質検査成績書を含む", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.usesTankOrWellWater = true;
  const documents = resolveTenpuDocuments(shisetsu);
  assert.ok(documents.some((d) => d.includes("水質検査")));
});

test("添付書類チェックリスト: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeTenpuChecklistDocx, buildSampleInshokutenEigyoProfile().shisetsu);
});
