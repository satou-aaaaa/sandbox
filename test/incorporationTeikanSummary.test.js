import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  resolveTeikanSummaryRows,
  checkCapitalConsistency,
  writeTeikanSummaryDocx,
} from "../src/incorporation/documents/teikanSummary.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "../scripts/sampleIncorporationCase.js";

async function assertWrittenDocx(writeFn, arg) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-incorporation-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(arg, outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("resolveTeikanSummaryRows: 株式会社は発行可能株式総数・公告方法・定款認証必要の行を含む", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  const rows = resolveTeikanSummaryRows(teikan);
  const map = Object.fromEntries(rows);
  assert.ok("発行可能株式総数等" in map);
  assert.ok("公告方法" in map);
  assert.equal(map["定款認証"], "必要（公証役場での認証手続きが必須です）");
  assert.ok("発起人" in map);
});

test("resolveTeikanSummaryRows: 合同会社は発行可能株式総数・公告方法の行を出力しない（FR-I1.4・FR-I4.2）", () => {
  const teikan = buildSampleGodoKaishaCase().teikan;
  const rows = resolveTeikanSummaryRows(teikan);
  const map = Object.fromEntries(rows);
  assert.ok(!("発行可能株式総数等" in map));
  assert.ok(!("公告方法" in map));
  assert.ok("社員" in map);
});

test("resolveTeikanSummaryRows: 合同会社は「社員の責任」行（全部を有限責任社員とする旨）を含む（会社法第576条第1項第5号）", () => {
  const teikan = buildSampleGodoKaishaCase().teikan;
  const rows = resolveTeikanSummaryRows(teikan);
  const map = Object.fromEntries(rows);
  assert.ok(map["社員の責任"].includes("有限責任社員"));
});

test("resolveTeikanSummaryRows: 合同会社は定款認証が不要である旨を明記する", () => {
  const teikan = buildSampleGodoKaishaCase().teikan;
  const rows = resolveTeikanSummaryRows(teikan);
  const map = Object.fromEntries(rows);
  assert.equal(map["定款認証"], "不要（持分会社のため、公証人の認証手続きはありません）");
});

test("resolveTeikanSummaryRows: 公告方法未記載の場合は官報とみなす旨を案内する", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  teikan.publicNoticeMethod = undefined;
  const rows = resolveTeikanSummaryRows(teikan);
  const map = Object.fromEntries(rows);
  assert.match(map["公告方法"], /官報/);
});

test("checkCapitalConsistency: 出資額合計と設立時財産価額が一致していれば警告なし", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  assert.deepEqual(checkCapitalConsistency(teikan), []);
});

test("checkCapitalConsistency: 出資額合計と設立時財産価額が不一致なら警告を返す（FR-I1.5。生成自体は妨げない）", () => {
  const teikan = buildSampleKabushikiKaishaCase().teikan;
  teikan.capitalAmount = 5_000_000;
  const warnings = checkCapitalConsistency(teikan);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /一致していません/);
});

test("定款サマリー: 株式会社のdocxファイルを生成できる", async () => {
  await assertWrittenDocx(writeTeikanSummaryDocx, buildSampleKabushikiKaishaCase().teikan);
});

test("定款サマリー: 合同会社のdocxファイルを生成できる", async () => {
  await assertWrittenDocx(writeTeikanSummaryDocx, buildSampleGodoKaishaCase().teikan);
});

test("定款サマリー: 生成モジュールのソースに「登記申請書」に類する語が含まれない（NFR-I3。単純な文字列検索）", async () => {
  const source = await fs.readFile(
    path.join(process.cwd(), "src/incorporation/documents/teikanSummary.js"),
    "utf8"
  );
  assert.ok(!source.includes("登記申請"));
  assert.ok(!source.includes("登記すべき事項"));
});

test("定款サマリー: 出力される行の値にも「登記申請書」に類する語が含まれない（ダミーデータでの確認）", () => {
  for (const teikan of [buildSampleKabushikiKaishaCase().teikan, buildSampleGodoKaishaCase().teikan]) {
    const rows = resolveTeikanSummaryRows(teikan);
    for (const [, value] of rows) {
      assert.ok(!String(value).includes("登記申請"));
    }
  }
});
