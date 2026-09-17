import { test } from "node:test";
import assert from "node:assert/strict";
import { registerField, getField, listFields, clearFields } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";
import { SEED_FIELDS, seedFieldRegistry } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.seed.js";

test("getField: 未登録キーはundefinedを返す", () => {
  clearFields();
  assert.equal(getField("no-such-field"), undefined);
});

test("registerField・getField: 登録後に正しいエントリが取得できる", () => {
  clearFields();
  registerField({ fieldKey: "test-field", fieldLabel: "テスト分野", skillTestName: "テスト試験", requiresSectorSpecificJapaneseTest: false });
  const field = getField("test-field");
  assert.equal(field?.fieldLabel, "テスト分野");
});

test("listFields: 登録済み全件を返す", () => {
  clearFields();
  registerField({ fieldKey: "f1", fieldLabel: "分野1", skillTestName: "試験1", requiresSectorSpecificJapaneseTest: false });
  registerField({ fieldKey: "f2", fieldLabel: "分野2", skillTestName: "試験2", requiresSectorSpecificJapaneseTest: false });
  assert.equal(listFields().length, 2);
});

test("SEED_FIELDS: 19分野が定義されている（e-Gov法令検索で確認済み・2026年9月）", () => {
  assert.equal(SEED_FIELDS.length, 19);
});

test("SEED_FIELDS: 分野キーに重複がない", () => {
  const keys = SEED_FIELDS.map((f) => f.fieldKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("seedFieldRegistry: 呼び出し後、全19分野がgetFieldで取得できる", () => {
  clearFields();
  seedFieldRegistry();
  assert.equal(listFields().length, 19);
  for (const seed of SEED_FIELDS) {
    assert.equal(getField(seed.fieldKey)?.fieldLabel, seed.fieldLabel);
  }
});

test("SEED_FIELDS: 介護分野は分野固有の日本語試験が必要とされている", () => {
  const kaigo = SEED_FIELDS.find((f) => f.fieldKey === "kaigo");
  assert.equal(kaigo?.requiresSectorSpecificJapaneseTest, true);
});
