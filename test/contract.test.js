/**
 * 契約テスト（JSON Schema + ajv）。
 *
 * 【なぜ導入したか】本ツールは現状、外部のAPI消費者（他システム・他サービス）
 * を持たない単一プロセスのローカルツールのため、Pact等の「消費者駆動契約
 * テスト」（consumer-driven contract testing）を導入するための相手がいない。
 * しかし「今後ローカル限定ではなくなる可能性がある」という前提の変化を踏まえ、
 * 将来 `data/clients.json` の形（`ClientRecord`/`LicenseEntry`。ADR-0008）を
 * そのままAPIレスポンスとして公開する可能性を見込み、その形を
 * `schemas/client-record.schema.json`（JSON Schema）として明文化した。
 * このスキーマを「破らずに」データを読み書きできているかを検証するのが
 * 本テストの役割であり、将来実際にAPIを公開する際は、この同じスキーマを
 * OpenAPI定義やPactの契約定義にそのまま転用できる。
 *
 * 【スキーマの位置づけ】`src/core/reminders/digest.js` のJSDoc型定義
 * （`ClientRecord`/`LicenseEntry`）が実装上の一次情報源であることに変わりは
 * ない。JSON Schemaはそれを「実行時に検証可能な形」で複製したものであり、
 * 型定義を変更した際はスキーマ側も追従させる必要がある（本テストが
 * その追従漏れを検出する）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { saveClients, loadClients } from "../src/core/reminders/clientStore.js";

const schema = JSON.parse(readFileSync(new URL("../schemas/client-record.schema.json", import.meta.url), "utf8"));

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

/** @param {unknown} data */
function assertValid(data) {
  const ok = validate(data);
  assert.ok(ok, `スキーマ違反:\n${JSON.stringify(validate.errors, null, 2)}`);
}

/** @param {unknown} data */
function assertInvalid(data) {
  const ok = validate(data);
  assert.equal(ok, false, "本来スキーマ違反であるべきデータが合格してしまった（スキーマが緩すぎる）");
}

test("契約: スキーマファイル自体が有効なJSON Schemaである", () => {
  // ajv.compile がエラーを投げずに完了することそのものが、スキーマ定義の
  // 構文・参照（$ref・$defs）の正しさを保証する。
  assert.ok(validate);
});

test("契約: 建設業許可の典型的なClientRecordがスキーマに適合する", () => {
  assertValid({
    clientName: "サンプル建設株式会社",
    fiscalYearEndIso: "2026-03-31",
    contactEmail: "info@example.com",
    licenses: [{ licenseId: "般-建築工事業", licenseCategory: "construction", licenseType: "一般", grantDateIso: "2024-04-01" }],
  });
});

test("契約: 古物商許可のClientRecord（grantDateIso省略・licenseCategory固有の追加フィールド）もスキーマに適合する", () => {
  // 古物商許可はgrantDateIsoを使わず、代わりにkobutsuDetailという
  // licenseCategory固有の追加フィールドを持つ（docs/DESIGN_kobutsu-core.md 4.4節）。
  // コアのスキーマはこれを規定しないが、additionalProperties: trueにより
  // 拒否せず受け入れられることを確認する（コアが許可種別を知らないという
  // 設計原則がスキーマレベルでも保たれていることの確認）。
  assertValid({
    clientName: "サンプル古物商",
    licenses: [
      {
        licenseId: "既定",
        licenseCategory: "kobutsu",
        kobutsuDetail: { lastRecordedChangeDateIso: "2026-08-01" },
      },
    ],
  });
});

test("契約: 最小構成（licenseCategory・fiscalYearEndIso・contactEmail省略）もスキーマに適合する（後方互換）", () => {
  assertValid({
    clientName: "最小構成建設",
    licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }],
  });
});

test("契約: 必須フィールドの欠落はスキーマ違反として検出される", () => {
  assertInvalid({ licenses: [{ licenseId: "既定" }] }); // clientName欠落
  assertInvalid({ clientName: "テスト建設" }); // licenses欠落
  assertInvalid({ clientName: "テスト建設", licenses: [] }); // licensesが空配列（1件以上必須）
  assertInvalid({ clientName: "テスト建設", licenses: [{}] }); // licenseId欠落
});

test("契約: 型の不一致はスキーマ違反として検出される", () => {
  assertInvalid({ clientName: 12345, licenses: [{ licenseId: "既定" }] }); // clientNameが数値
  assertInvalid({ clientName: "テスト建設", licenses: "既定" }); // licensesが配列でない
  assertInvalid({
    clientName: "テスト建設",
    licenses: [{ licenseId: "既定", licenseType: "存在しない区分" }], // licenseTypeがenum外
  });
  assertInvalid({
    clientName: "テスト建設",
    licenses: [{ licenseId: "既定", grantDateIso: "2024/04/01" }], // date形式でない（スラッシュ区切り）
  });
});

test("契約: スキーマで規定していない未知のトップレベルフィールドは拒否される（additionalProperties: false）", () => {
  assertInvalid({ clientName: "テスト建設", licenses: [{ licenseId: "既定" }], unknownField: "想定外の値" });
});

test("契約: clientStore.js経由で実際に保存・読込したデータがスキーマに適合し続ける（実装とスキーマの乖離を検出する回帰テスト）", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kensetsu-kyoka-toolkit-contract-test-"));
  const filePath = path.join(dir, "clients.json");
  try {
    const original = [
      {
        clientName: "契約テスト建設",
        fiscalYearEndIso: "2026-03-31",
        contactEmail: "info@example.com",
        licenses: [
          { licenseId: "般-建築工事業", licenseCategory: "construction", licenseType: "一般", grantDateIso: "2020-04-01" },
          { licenseId: "特-とび土工工事業", licenseCategory: "construction", licenseType: "特定", grantDateIso: "2024-04-01" },
        ],
      },
    ];
    await saveClients(original, filePath);
    const loaded = await loadClients(filePath);

    assert.equal(loaded.length, 1);
    for (const client of loaded) {
      assertValid(client);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
