import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveKeieikiboHyoukaRows, writeKeieikiboHyoukaDocx } from "../src/licenses/keiei-jiko-shinsa/documents/keieikiboHyouka.js";
import { resolveKeieijoukyouBunsekiRows, writeKeieijoukyouBunsekiDocx } from "../src/licenses/keiei-jiko-shinsa/documents/keieijoukyouBunseki.js";
import { REQUIRED_DOCUMENTS, writeChecklistDocx } from "../src/licenses/keiei-jiko-shinsa/documents/checklist.js";
import { buildSampleKeieiJikoShinsaProfile } from "../scripts/sampleKeieiJikoShinsaProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, arg) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-keiei-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(arg, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("経営規模等評価申請書: 業種区分・技術職員数が反映される", () => {
  const rows = resolveKeieikiboHyoukaRows(buildSampleKeieiJikoShinsaProfile());
  const map = Object.fromEntries(rows);
  assert.equal(map["経審を受ける業種区分"], "とび・土工工事業、管工事業");
  assert.ok(map["Z: 技術職員数（資格区分別）"].includes("1級土木施工管理技士: 2名"));
});

test("経営規模等評価申請書: X1未入力なら（未入力）と表示される", () => {
  const profile = buildSampleKeieiJikoShinsaProfile();
  profile.x1.annualCompletedWorkAmounts = [];
  const rows = resolveKeieikiboHyoukaRows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["X1: 完成工事高（直近実績。参考値）"], "（未入力）");
});

test("経営規模等評価申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeKeieikiboHyoukaDocx, buildSampleKeieiJikoShinsaProfile());
});

test("経営状況分析申請書: 自己資本額・利払前利益が反映される", () => {
  const rows = resolveKeieijoukyouBunsekiRows(buildSampleKeieiJikoShinsaProfile());
  const map = Object.fromEntries(rows);
  assert.equal(map["自己資本額（貸借対照表の純資産合計）"], "50,000,000円");
});

test("経営状況分析申請書: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeKeieijoukyouBunsekiDocx, buildSampleKeieiJikoShinsaProfile());
});

test("必要書類チェックリスト: 一覧に主要書類が含まれる", () => {
  assert.ok(REQUIRED_DOCUMENTS.includes("工事経歴書"));
  assert.ok(REQUIRED_DOCUMENTS.includes("経営状況分析結果通知書（登録経営状況分析機関から受領したもの）"));
});

test("必要書類チェックリスト: docxファイルを生成できる", async () => {
  await assertWrittenDocx((_, outPath) => writeChecklistDocx(outPath), undefined);
});
