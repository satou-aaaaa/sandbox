import { test } from "node:test";
import assert from "node:assert/strict";
import { clientsToCsv, clientsFromCsv } from "../src/reminders/clientCsv.js";

test("clientsToCsv: ヘッダーとデータ行を正しく出力する", () => {
  const csv = clientsToCsv([{ clientName: "テスト建設", grantDateIso: "2024-04-01" }]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "clientName,grantDateIso,fiscalYearEndIso,contactEmail");
  assert.equal(lines[1], "テスト建設,2024-04-01,,");
});

test("clientsToCsv: カンマ・ダブルクォートを含む値はエスケープする", () => {
  const csv = clientsToCsv([{ clientName: 'サンプル, "建設"株式会社', grantDateIso: "2024-04-01" }]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[1], '"サンプル, ""建設""株式会社",2024-04-01,,');
});

test("clientsFromCsv → clientsToCsv の往復でデータが保持される（特殊文字含む）", () => {
  const original = [
    { clientName: "テスト建設", grantDateIso: "2024-04-01", fiscalYearEndIso: "2026-03-31", contactEmail: "a@example.com" },
    { clientName: 'サンプル, "建設"株式会社', grantDateIso: "2020-04-01" },
  ];
  const csv = clientsToCsv(original);
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].clientName, "テスト建設");
  assert.equal(parsed[0].fiscalYearEndIso, "2026-03-31");
  assert.equal(parsed[0].contactEmail, "a@example.com");
  assert.equal(parsed[1].clientName, 'サンプル, "建設"株式会社');
  assert.equal(parsed[1].fiscalYearEndIso, undefined);
});

test("clientsFromCsv: 空文字列は空配列を返す", () => {
  assert.deepEqual(clientsFromCsv(""), []);
});

test("clientsFromCsv: ヘッダーのみ（データ行なし）は空配列を返す", () => {
  assert.deepEqual(clientsFromCsv("clientName,grantDateIso,fiscalYearEndIso,contactEmail\r\n"), []);
});

test("clientsFromCsv: clientNameまたはgrantDateIsoが欠けている行はスキップする", () => {
  const csv = [
    "clientName,grantDateIso,fiscalYearEndIso,contactEmail",
    "テスト建設,2024-04-01,,",
    ",2024-04-01,,", // clientName欠落
    "名前だけ,,,", // grantDateIso欠落
  ].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].clientName, "テスト建設");
});

test("clientsFromCsv: 列の並び順が変わっていてもヘッダー名でマッピングする", () => {
  const csv = ["grantDateIso,clientName", "2024-04-01,テスト建設"].join("\r\n");
  const parsed = clientsFromCsv(csv);
  assert.equal(parsed[0].clientName, "テスト建設");
  assert.equal(parsed[0].grantDateIso, "2024-04-01");
});
