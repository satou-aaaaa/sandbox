import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDocumentChecklist } from "../src/licenses/minpaku/eligibility/documentChecklist.js";

test("checkDocumentChecklist: 全書類取得済みなら合格し理由は1件のみ", () => {
  const result = checkDocumentChecklist([
    { key: "a", label: "登記事項証明書", obtained: true },
    { key: "b", label: "図面", obtained: true },
  ]);
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["必要書類はすべて取得済みです"]);
  assert.equal(result.warnings.length, 0);
});

test("checkDocumentChecklist: 未取得の書類があれば不合格になり、書類名ごとに理由が列挙される", () => {
  const result = checkDocumentChecklist([
    { key: "a", label: "登記事項証明書", obtained: true },
    { key: "b", label: "消防法令適合通知書", obtained: false },
  ]);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["消防法令適合通知書が未取得です"]);
});

test("checkDocumentChecklist: 外国語発行の書類が取得済みなら日本語訳確認の警告を出す", () => {
  const result = checkDocumentChecklist([{ key: "a", label: "海外の身分証明書", obtained: true, isForeignLanguage: true }]);
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("日本語訳"));
});

test("checkDocumentChecklist: 外国語発行の書類が未取得なら日本語訳の警告は出さない（未取得の理由のみ）", () => {
  const result = checkDocumentChecklist([{ key: "a", label: "海外の身分証明書", obtained: false, isForeignLanguage: true }]);
  assert.equal(result.passed, false);
  assert.equal(result.warnings.length, 0);
});
