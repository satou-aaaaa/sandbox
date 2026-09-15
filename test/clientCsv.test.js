import { test } from "node:test";
import assert from "node:assert/strict";
import { clientsToCsv, clientsFromCsv } from "../src/core/reminders/clientCsv.js";

test("clientsToCsv: ヘッダーと1許可分のデータ行を正しく出力する", () => {
  const csv = clientsToCsv([
    { clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] },
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "clientName,licenseId,licenseCategory,licenseType,grantDateIso,fiscalYearEndIso,contactEmail");
  assert.equal(lines[1], "テスト建設,既定,,,2024-04-01,,");
});

test("clientsToCsv: 1クライアントが複数許可を持つ場合は1行＝1許可で出力する（会社単位の列は繰り返す）", () => {
  const csv = clientsToCsv([
    {
      clientName: "テスト建設",
      fiscalYearEndIso: "2026-03-31",
      licenses: [
        { licenseId: "般-建築工事業", licenseType: "一般", grantDateIso: "2020-04-01" },
        { licenseId: "特-とび土工工事業", licenseType: "特定", grantDateIso: "2024-04-01" },
      ],
    },
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 3); // ヘッダー + 許可2件分
  assert.equal(lines[1], "テスト建設,般-建築工事業,,一般,2020-04-01,2026-03-31,");
  assert.equal(lines[2], "テスト建設,特-とび土工工事業,,特定,2024-04-01,2026-03-31,"); // 会社単位の列（fiscalYearEndIso）は繰り返す
});

test("clientsToCsv: カンマ・ダブルクォートを含む値はエスケープする", () => {
  const csv = clientsToCsv([
    { clientName: 'サンプル, "建設"株式会社', licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] },
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[1], '"サンプル, ""建設""株式会社",既定,,,2024-04-01,,');
});

test("clientsFromCsv → clientsToCsv の往復でデータが保持される（特殊文字含む・複数許可含む）", () => {
  const original = [
    {
      clientName: "テスト建設",
      fiscalYearEndIso: "2026-03-31",
      contactEmail: "a@example.com",
      licenses: [
        { licenseId: "般-建築工事業", licenseType: "一般", grantDateIso: "2020-04-01" },
        { licenseId: "特-とび土工工事業", licenseType: "特定", grantDateIso: "2024-04-01" },
      ],
    },
    { clientName: 'サンプル, "建設"株式会社', licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] },
  ];
  const csv = clientsToCsv(original);
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].clientName, "テスト建設");
  assert.equal(parsed[0].fiscalYearEndIso, "2026-03-31");
  assert.equal(parsed[0].contactEmail, "a@example.com");
  assert.equal(parsed[0].licenses.length, 2);
  assert.equal(parsed[0].licenses[0].licenseId, "般-建築工事業");
  assert.equal(parsed[0].licenses[0].licenseType, "一般");
  assert.equal(parsed[0].licenses[1].licenseId, "特-とび土工工事業");
  assert.equal(parsed[1].clientName, 'サンプル, "建設"株式会社');
  assert.equal(parsed[1].fiscalYearEndIso, undefined);
});

test("clientsFromCsv: 空文字列は空配列を返す", () => {
  assert.deepEqual(clientsFromCsv(""), []);
});

test("clientsFromCsv: データ行の間に空行が混じっていても無視して読み込む", () => {
  const csv = [
    "clientName,licenseId,licenseType,grantDateIso,fiscalYearEndIso,contactEmail",
    "テスト建設,既定,,2024-04-01,,",
    "", // 空行
    "別会社,既定,,2022-01-01,,",
  ].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 2);
  assert.deepEqual(
    parsed.map((c) => c.clientName),
    ["テスト建設", "別会社"]
  );
});

test("clientsFromCsv: ヘッダーのみ（データ行なし）は空配列を返す", () => {
  assert.deepEqual(
    clientsFromCsv("clientName,licenseId,licenseType,grantDateIso,fiscalYearEndIso,contactEmail\r\n"),
    []
  );
});

test("clientsFromCsv: clientNameまたはgrantDateIsoが欠けている行はスキップする", () => {
  const csv = [
    "clientName,licenseId,licenseType,grantDateIso,fiscalYearEndIso,contactEmail",
    "テスト建設,既定,,2024-04-01,,",
    ",既定,,2024-04-01,,", // clientName欠落
    "名前だけ,既定,,,,", // grantDateIso欠落
  ].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].clientName, "テスト建設");
});

test("clientsFromCsv: 列の並び順が変わっていてもヘッダー名でマッピングする", () => {
  const csv = ["grantDateIso,clientName,licenseId", "2024-04-01,テスト建設,般-建築工事業"].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed[0].clientName, "テスト建設");
  assert.equal(parsed[0].licenses[0].licenseId, "般-建築工事業");
  assert.equal(parsed[0].licenses[0].grantDateIso, "2024-04-01");
});

test("clientsFromCsv: licenseId列が無い旧形式CSVは licenseId を「既定」として読み込む（後方互換・FR-5.6）", () => {
  const csv = ["clientName,grantDateIso,fiscalYearEndIso,contactEmail", "テスト建設,2024-04-01,2026-03-31,a@example.com"].join(
    "\r\n"
  );
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].clientName, "テスト建設");
  assert.equal(parsed[0].fiscalYearEndIso, "2026-03-31");
  assert.equal(parsed[0].licenses.length, 1);
  assert.equal(parsed[0].licenses[0].licenseId, "既定");
  assert.equal(parsed[0].licenses[0].grantDateIso, "2024-04-01");
});

test("clientsFromCsv: licenseCategoryが古物商許可等（\"construction\"以外）の行は、grantDateIsoが空でも読み捨てられない", () => {
  // 回帰テスト: 古物商許可はgrantDateIsoを持たない設計（docs/DESIGN_kobutsu-core.md
  // 4.4節）のため、grantDateIso必須チェックをlicenseCategoryに関わらず一律に
  // 適用すると、古物商許可のCSV行が全て黙って読み捨てられてしまっていた
  // （5.5節の設計レビューで判明した見落とし）。
  const csv = [
    "clientName,licenseId,licenseCategory,licenseType,grantDateIso,fiscalYearEndIso,contactEmail",
    "サンプル古物商,既定,kobutsu,,,,",
  ].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].clientName, "サンプル古物商");
  assert.equal(parsed[0].licenses[0].licenseCategory, "kobutsu");
  assert.equal("grantDateIso" in parsed[0].licenses[0], false);
});

test("clientsFromCsv: licenseCategory列が無い（または空の）行は\"construction\"として扱う（後方互換）", () => {
  const csv = [
    "clientName,licenseId,licenseType,grantDateIso,fiscalYearEndIso,contactEmail",
    "テスト建設,既定,,2024-04-01,,",
  ].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed[0].licenses[0].licenseCategory, "construction");
});

test("clientsFromCsv: 同一clientNameの複数行は1つのClientRecordのlicensesへ集約する", () => {
  const csv = [
    "clientName,licenseId,licenseType,grantDateIso,fiscalYearEndIso,contactEmail",
    "テスト建設,般-建築工事業,一般,2020-04-01,2026-03-31,a@example.com",
    "テスト建設,特-とび土工工事業,特定,2024-04-01,2026-03-31,a@example.com",
    "別会社,既定,,2022-01-01,,",
  ].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 2); // クライアントとしては2件（許可としては3件）
  const testKensetsu = parsed.find((c) => c.clientName === "テスト建設");
  assert.equal(testKensetsu.licenses.length, 2);
  assert.equal(testKensetsu.fiscalYearEndIso, "2026-03-31");
  assert.equal(testKensetsu.contactEmail, "a@example.com");
});
