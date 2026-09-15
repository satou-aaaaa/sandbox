import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { clientsToCsv, clientsFromCsv } from "../src/core/reminders/clientCsv.js";

test("clientsToCsv: ヘッダーと1許可分のデータ行を正しく出力する", () => {
  const csv = clientsToCsv([
    { clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] },
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "clientName,licenseId,licenseCategory,licenseType,grantDateIso,fiscalYearEndIso,contactEmail");
  assert.equal(lines[1], "テスト建設,既定,,,2024-04-01,,");
  // 末尾の改行（\r\n）そのものの有無も確認する（他のテストは.trim()してから比較する
  // ため、末尾の\r\nが欠けてもここでは検出できない）。
  assert.ok(csv.endsWith("\r\n"), "出力末尾は\\r\\nで終わるはず");
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

test("clientsFromCsv: 複数列のうち1列目だけが空文字列の行は空行として読み捨てられない（AND条件がORに壊れていないかの確認）", () => {
  const csv = [
    "licenseId,clientName,grantDateIso",
    ",テスト建設,2024-04-01", // 1列目(licenseId)は空文字列だが、他の列に値がある実データ行
  ].join("\r\n");
  assert.deepEqual(
    clientsFromCsv(csv).map((c) => c.clientName),
    ["テスト建設"]
  );
});

test("clientsFromCsv: 末尾に改行が無いCSVでも最終行を読み落とさない", () => {
  const csvWithoutTrailingNewline = "clientName,licenseId,grantDateIso\r\nテスト建設,既定,2024-04-01";
  const parsed = clientsFromCsv(csvWithoutTrailingNewline);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].clientName, "テスト建設");
  assert.equal(parsed[0].licenses[0].grantDateIso, "2024-04-01");
});

test("clientsFromCsv: fiscalYearEndIso・contactEmail・licenseTypeが空欄の行は、そのキー自体を持たないオブジェクトになる（undefinedを明示代入しない）", () => {
  const csv = ["clientName,licenseId,licenseType,grantDateIso,fiscalYearEndIso,contactEmail", "テスト建設,既定,,2024-04-01,,"].join(
    "\r\n"
  );
  const [parsed] = clientsFromCsv(csv);
  assert.equal("fiscalYearEndIso" in parsed, false);
  assert.equal("contactEmail" in parsed, false);
  assert.equal("licenseType" in parsed.licenses[0], false);
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

/**
 * ここからProperty-based testing（fast-check）。
 *
 * 上の具体例ベースのテストは「カンマとダブルクォートを含む値」など、
 * 書き手が思いついた特殊文字の組み合わせしか検証できない。CSV相互変換は
 * 「任意の文字列（制御文字・改行コードの混在・サロゲートペア等を含む）を
 * 書き出して読み込んでも元の値に戻る」という往復性（round-trip property）が
 * 本質的に満たすべき性質であるため、ランダムな文字列を大量に生成して
 * 検証する。
 */
test("clientsToCsv → clientsFromCsv の往復は、CSVを壊しうる特殊文字を含む任意の文字列でもデータを保持する [property]", () => {
  const nonEmptyStringArb = fc.string({ minLength: 1 }).filter((s) => s.length > 0);
  const isoDateArb = fc
    .date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2035-12-31T00:00:00Z"), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10));

  fc.assert(
    fc.property(
      nonEmptyStringArb, // clientName（空文字列は行スキップの仕様のため対象外）
      nonEmptyStringArb, // licenseId（同上。空だと"既定"に補完される仕様のため対象外）
      isoDateArb, // grantDateIso
      fc.option(fc.constantFrom("一般", "特定"), { nil: undefined }), // licenseType
      fc.option(nonEmptyStringArb, { nil: undefined }), // fiscalYearEndIso（CSVは空文字列と未設定を区別できない仕様のため、空文字列は対象外）
      fc.option(nonEmptyStringArb, { nil: undefined }), // contactEmail（同上）
      (clientName, licenseId, grantDateIso, licenseType, fiscalYearEndIso, contactEmail) => {
        /** @type {import('../src/core/reminders/digest.js').ClientRecord} */
        const original = {
          clientName,
          licenses: [
            {
              licenseId,
              licenseCategory: "construction",
              grantDateIso,
              ...(licenseType !== undefined ? { licenseType } : {}),
            },
          ],
          ...(fiscalYearEndIso !== undefined ? { fiscalYearEndIso } : {}),
          ...(contactEmail !== undefined ? { contactEmail } : {}),
        };

        const csv = clientsToCsv([original]);
        const parsed = clientsFromCsv(csv);

        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].clientName, clientName);
        assert.equal(parsed[0].licenses.length, 1);
        assert.equal(parsed[0].licenses[0].licenseId, licenseId);
        assert.equal(parsed[0].licenses[0].grantDateIso, grantDateIso);
        assert.equal(parsed[0].licenses[0].licenseType, licenseType);
        assert.equal(parsed[0].fiscalYearEndIso, fiscalYearEndIso);
        assert.equal(parsed[0].contactEmail, contactEmail);
      }
    ),
    { numRuns: 300 }
  );
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
