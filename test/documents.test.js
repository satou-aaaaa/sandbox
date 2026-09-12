import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { resolveYoushiki1Rows, writeYoushiki1Docx } from "../src/documents/youshiki1.js";
import { resolveYoushiki2Rows, writeYoushiki2Docx } from "../src/documents/youshiki2.js";
import { resolveYoushiki6Rows, writeYoushiki6Docx } from "../src/documents/youshiki6.js";
import { resolveYoushiki7Fields, writeYoushiki7Docx } from "../src/documents/youshiki7.js";
import { resolveYoushiki8Sections, writeYoushiki8Docx } from "../src/documents/youshiki8.js";
import { resolveYoushiki20_2Fields, writeYoushiki20_2Docx } from "../src/documents/youshiki20-2.js";
import { resolveYoushiki25_14Rows, writeYoushiki25_14Docx } from "../src/documents/youshiki25-14.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

/** 生成された docx バッファが有効な zip（docxの実体）であることを確認する。 */
async function assertWrittenDocx(writeFn, profile) {
  const outPath = path.join(os.tmpdir(), `kensetsu-kyoka-toolkit-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeFn(profile, outPath);
    const buffer = await fs.readFile(outPath);
    // docx（.docx）は zip 形式であり、先頭2バイトは "PK" (0x50, 0x4B)。
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
}

test("様式第一号: 必須項目が未入力なら（未入力）と表示される", () => {
  const profile = buildSampleApplicantProfile();
  profile.representativeName = "";
  profile.address = undefined;
  const rows = resolveYoushiki1Rows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["代表者氏名"], "（未入力）");
  assert.equal(map["主たる営業所の所在地"], "（未入力）");
});

test("様式第一号: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki1Docx, buildSampleApplicantProfile());
});

test("様式第二号: 工事経歴が未入力なら空配列を返す", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [];
  const rows = resolveYoushiki2Rows(profile);
  assert.equal(rows.length, 0);
});

test("様式第二号: 元請を先に、請負代金の額の大きい順に並べる", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [
    { constructionType: "建築工事業", isSubcontract: false, orderer: "A社", projectName: "工事A", contractAmount: 1_000_000, completionDateIso: "2025-01" },
    { constructionType: "建築工事業", isSubcontract: true, orderer: "B社", projectName: "工事B", contractAmount: 9_000_000, completionDateIso: "2025-02" },
    { constructionType: "建築工事業", isSubcontract: false, orderer: "C社", projectName: "工事C", contractAmount: 5_000_000, completionDateIso: "2025-03" },
  ];
  const rows = resolveYoushiki2Rows(profile);
  // 元請2件（C社→A社、金額降順）が先、下請1件（B社）が最後になるはず。
  assert.deepEqual(rows.map((r) => r[2]), ["C社", "A社", "B社"]);
  assert.deepEqual(rows.map((r) => r[1]), ["元請", "元請", "下請"]);
});

test("様式第二号: 請負代金の額は3桁区切りで表示される", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [
    { constructionType: "建築工事業", isSubcontract: false, orderer: "A社", projectName: "工事A", contractAmount: 12_345_678, completionDateIso: "2025-01" },
  ];
  const rows = resolveYoushiki2Rows(profile);
  assert.equal(rows[0][4], "12,345,678円");
});

test("様式第二号: 着手年月が未入力でも完成年月のみで工期を表示する", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [
    { constructionType: "建築工事業", isSubcontract: false, orderer: "A社", projectName: "工事A", contractAmount: 1_000_000, completionDateIso: "2025-01" },
  ];
  const rows = resolveYoushiki2Rows(profile);
  assert.match(rows[0][5], /2025-01/);
});

test("様式第二号: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki2Docx, buildSampleApplicantProfile());
});

test("様式第二号: 工事経歴が未入力でもdocxファイルを生成できる", async () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [];
  await assertWrittenDocx(writeYoushiki2Docx, profile);
});

test("様式第六号: 役員が未入力なら未入力である旨の行を返す", () => {
  const profile = buildSampleApplicantProfile();
  profile.officers = [];
  const rows = resolveYoushiki6Rows(profile);
  assert.equal(rows.length, 1);
  assert.match(rows[0][1], /未入力/);
});

test("様式第六号: 役員1名分の氏名・役名・生年月日が未入力なら（未入力）になる", () => {
  const profile = buildSampleApplicantProfile();
  profile.officers = [{ name: "", title: "", birthDate: "" }];
  const rows = resolveYoushiki6Rows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["役員 1 — 氏名"], "（未入力）");
  assert.equal(map["役員 1 — 役名"], "（未入力）");
  assert.equal(map["役員 1 — 生年月日"], "（未入力）");
});

test("様式第六号: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki6Docx, buildSampleApplicantProfile());
});

test("様式第七号: 証明を受ける者の氏名が未入力なら（未入力）になる", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.responsibleName = undefined;
  const { rows } = resolveYoushiki7Fields(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["証明を受ける者の氏名"], "（未入力）");
});

test("様式第七号: 判定結果は要件判定エンジンと同じロジック（checkKeieiGyomuKanri）を使う", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.hasSocialInsurance = false; // 社会保険未加入 → 不合格になるはず
  const { check } = resolveYoushiki7Fields(profile);
  assert.equal(check.passed, false);
});

test("様式第七号: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki7Docx, buildSampleApplicantProfile());
});

test("様式第八号: 営業所が未入力なら空配列を返す", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [];
  const sections = resolveYoushiki8Sections(profile);
  assert.equal(sections.length, 0);
});

test("様式第八号: 専任技術者の氏名が未入力なら（未入力）になる", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList[0].personName = undefined;
  const sections = resolveYoushiki8Sections(profile);
  const map = Object.fromEntries(sections[0].rows);
  assert.equal(map["専任技術者の氏名"], "（未入力）");
});

test("様式第八号: 特定建設業で指導監督的実務経験が不足していれば不合格になる", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 1,
    },
  ];
  const sections = resolveYoushiki8Sections(profile);
  assert.equal(sections[0].check.passed, false);
});

test("様式第八号: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki8Docx, buildSampleApplicantProfile());
});

test("様式第二十号の二: 代表者氏名が未入力なら（未入力）になる", () => {
  const profile = buildSampleApplicantProfile();
  profile.representativeName = undefined;
  const { rows } = resolveYoushiki20_2Fields(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["代表者氏名"], "（未入力）");
});

test("様式第二十号の二: 欠格事由に該当すれば不合格になる", () => {
  const profile = buildSampleApplicantProfile();
  profile.kekkaku.isBoryokudanMemberOrWithin5Years = true;
  const { check } = resolveYoushiki20_2Fields(profile);
  assert.equal(check.passed, false);
});

test("様式第二十号の二: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki20_2Docx, buildSampleApplicantProfile());
});

test("様式第二十五号の十四: keishinRequestが未入力でも（未入力）で表示される", () => {
  const profile = buildSampleApplicantProfile();
  profile.keishinRequest = undefined;
  const rows = resolveYoushiki25_14Rows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["商号又は名称のフリガナ"], "（未入力）");
  assert.equal(map["許可番号・許可年月日・許可行政庁"], "（未入力）");
  assert.equal(map["経営状況分析を受けた機関名"], "（未入力）");
});

test("様式第二十五号の十四: 資本金の額はApplicantProfile本体（zaisanKiso）から取得する", () => {
  const profile = buildSampleApplicantProfile();
  profile.zaisanKiso.capitalAmount = 20_000_000;
  const rows = resolveYoushiki25_14Rows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["資本金の額"], "20,000,000円");
});

test("様式第二十五号の十四: 自己資本額は1期分がデフォルトで、2期平均は明示指定時のみ前期分を表示する", () => {
  const profile = buildSampleApplicantProfile();
  let rows = resolveYoushiki25_14Rows(profile);
  let map = Object.fromEntries(rows);
  assert.equal(map["自己資本額の算定方法"], "1期分（審査基準日の決算額）");
  assert.equal(map["自己資本額（前回申請時の審査基準日）"], undefined);

  profile.keishinRequest.useNetAssetsTwoYearAverage = true;
  profile.keishinRequest.previousNetAssets = 5_000_000;
  rows = resolveYoushiki25_14Rows(profile);
  map = Object.fromEntries(rows);
  assert.equal(map["自己資本額の算定方法"], "2期平均");
  assert.equal(map["自己資本額（前回申請時の審査基準日）"], "5,000,000円");
});

test("様式第二十五号の十四: 技術職員数は専任技術者一覧の件数から算出する", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList.push({ ...profile.senninGijutsushaList[0], officeName: "支店" });
  const rows = resolveYoushiki25_14Rows(profile);
  const map = Object.fromEntries(rows);
  assert.equal(map["技術職員数（専任技術者一覧からの参考値）"], "2名");
});

test("様式第二十五号の十四: docxファイルを生成できる", async () => {
  await assertWrittenDocx(writeYoushiki25_14Docx, buildSampleApplicantProfile());
});

test("様式第二十五号の十四: keishinRequestが未入力でもdocxファイルを生成できる", async () => {
  const profile = buildSampleApplicantProfile();
  profile.keishinRequest = undefined;
  await assertWrittenDocx(writeYoushiki25_14Docx, profile);
});
