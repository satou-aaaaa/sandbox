import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { Paragraph } from "docx";

import {
  resolveYoushiki2FormSheets,
  buildYoushiki2FormDocument,
  writeYoushiki2FormDocx,
  toThousandYen,
  formatYearMonth,
  padRows,
  MIN_TABLE_ROWS,
  UNKNOWN_CONSTRUCTION_TYPE,
} from "../src/documents/youshiki2-form.js";
import { buildFormLayoutDisclaimerParagraph } from "../src/core/documents/common.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

/** @returns {import('../src/licenses/construction/eligibility/types.js').WorkRecordInput} */
function work(overrides) {
  return {
    constructionType: "建築工事業",
    isSubcontract: false,
    orderer: "A社",
    projectName: "工事A",
    contractAmount: 1_000_000,
    completionDateIso: "2025-01",
    ...overrides,
  };
}

test("罫線版 様式第二号: 業種ごとにシートを分け、constructionTypes の順に並べる", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionTypes = ["土木工事業", "建築工事業"];
  profile.constructionHistory = [
    work({ constructionType: "建築工事業", orderer: "建築A" }),
    work({ constructionType: "内装仕上工事業", orderer: "内装A" }),
    work({ constructionType: "土木工事業", orderer: "土木A" }),
    work({ constructionType: "", orderer: "不明A" }),
  ];
  const sheets = resolveYoushiki2FormSheets(profile);
  assert.deepEqual(
    sheets.map((s) => s.constructionType),
    ["土木工事業", "建築工事業", "内装仕上工事業", UNKNOWN_CONSTRUCTION_TYPE]
  );
});

test("罫線版 様式第二号: シート内は元請が先、金額の大きい順（サマリー版と同じ順序）", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [
    work({ orderer: "A社", contractAmount: 1_000_000 }),
    work({ orderer: "B社", isSubcontract: true, contractAmount: 9_000_000 }),
    work({ orderer: "C社", contractAmount: 5_000_000 }),
  ];
  const [sheet] = resolveYoushiki2FormSheets(profile);
  assert.deepEqual(sheet.rows.map((r) => r.orderer), ["C社", "A社", "B社"]);
  assert.deepEqual(sheet.rows.map((r) => r.contractorType), ["元請", "元請", "下請"]);
});

test("罫線版 様式第二号: 金額は千円単位（切り捨て）、合計とうち元請工事を出す", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [
    work({ contractAmount: 12_345_678 }),
    work({ isSubcontract: true, contractAmount: 1_999 }),
    work({ isSubcontract: true, contractAmount: NaN }),
  ];
  const [sheet] = resolveYoushiki2FormSheets(profile);
  assert.equal(sheet.rows[0].amountThousandYen, "12,345");
  assert.equal(sheet.rows[1].amountThousandYen, "1");
  assert.equal(sheet.rows[2].amountThousandYen, "");
  assert.equal(sheet.totalCount, 3);
  assert.equal(sheet.totalAmountThousandYen, "12,347");
  assert.equal(sheet.primeCount, 1);
  assert.equal(sheet.primeAmountThousandYen, "12,345");
});

test("罫線版 様式第二号: 配置技術者の別は該当欄にレ印を付ける", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [
    work({ orderer: "A社", contractAmount: 3, assignedEngineerName: "田中 次郎", engineerRole: "主任技術者" }),
    work({ orderer: "B社", contractAmount: 2, assignedEngineerName: "鈴木 三郎", engineerRole: "監理技術者" }),
    work({ orderer: "C社", contractAmount: 1, assignedEngineerName: "高橋 四郎" }),
  ];
  const [sheet] = resolveYoushiki2FormSheets(profile);
  assert.deepEqual(
    sheet.rows.map((r) => [r.engineerName, r.chiefEngineerMark, r.supervisingEngineerMark]),
    [
      ["田中 次郎", "レ", ""],
      ["鈴木 三郎", "", "レ"],
      ["高橋 四郎", "", ""],
    ]
  );
});

test("罫線版 様式第二号: 入力項目の無い欄（JV・工事現場）は空欄で出す", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [work({ orderer: undefined, projectName: undefined })];
  const [row] = resolveYoushiki2FormSheets(profile)[0].rows;
  assert.equal(row.jointVenture, "");
  assert.equal(row.siteLocation, "");
  assert.equal(row.orderer, "");
  assert.equal(row.projectName, "");
  assert.equal(row.engineerName, "");
});

test("罫線版 様式第二号: 工期は YYYY年M月 で表示し、着工年月が無ければ空欄", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = [work({ startDateIso: "2025-04", completionDateIso: "2025-12" })];
  const [row] = resolveYoushiki2FormSheets(profile)[0].rows;
  assert.equal(row.startMonth, "2025年4月");
  assert.equal(row.completionMonth, "2025年12月");
  assert.equal(formatYearMonth(undefined), "");
  assert.equal(formatYearMonth("令和7年4月"), "令和7年4月");
});

test("罫線版 様式第二号: 実績の無い申請業種も0件のシートとして出す", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionTypes = ["建築工事業", "大工工事業"];
  profile.constructionHistory = [];
  const sheets = resolveYoushiki2FormSheets(profile);
  assert.deepEqual(sheets.map((s) => [s.constructionType, s.totalCount, s.totalAmountThousandYen]), [
    ["建築工事業", 0, "0"],
    ["大工工事業", 0, "0"],
  ]);
});

test("toThousandYen: 数値でなければ空欄", () => {
  assert.equal(toThousandYen(Number.POSITIVE_INFINITY), "");
  assert.equal(toThousandYen(/** @type {any} */ ("1000")), "");
  assert.equal(toThousandYen(999), "0");
});

test("padRows: 最低行数まで空行で埋め、超えていればそのまま", () => {
  assert.equal(padRows([]).length, MIN_TABLE_ROWS);
  const many = Array.from({ length: MIN_TABLE_ROWS + 3 }, () => padRows([])[0]);
  assert.equal(padRows(many).length, MIN_TABLE_ROWS + 3);
});

test("罫線版 様式第二号: 工事経歴が未入力（undefined）ならシートは0枚、確認事項のページだけ出す", () => {
  const profile = buildSampleApplicantProfile();
  profile.constructionHistory = undefined;
  profile.constructionTypes = undefined;
  assert.equal(resolveYoushiki2FormSheets(profile).length, 0);
  assert.ok(buildYoushiki2FormDocument(profile));
});

test("buildFormLayoutDisclaimerParagraph: 人手確認の注記段落を1つ返す", () => {
  assert.ok(buildFormLayoutDisclaimerParagraph() instanceof Paragraph);
});

test("罫線版 様式第二号: docxファイルを生成できる", async () => {
  const outPath = path.join(os.tmpdir(), `youshiki2-form-test-${Date.now()}-${Math.random()}.docx`);
  try {
    await writeYoushiki2FormDocx(buildSampleApplicantProfile(), outPath);
    const buffer = await fs.readFile(outPath);
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
  } finally {
    await fs.rm(outPath, { force: true });
  }
});
