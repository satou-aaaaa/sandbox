import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKobutsuEigyosho } from "../src/licenses/kobutsu/eligibility/eigyosho.js";

test("checkKobutsuEigyosho: 営業所が1件、使用権限確認済み・管理者常勤なら合格し、key/label/reasons/warningsが厳密に一致する", () => {
  const result = checkKobutsuEigyosho([
    { officeName: "本店", hasLegitimateUsageRight: true, managerName: "山田 太郎", isManagerFullTime: true },
  ]);
  assert.equal(result.key, "kobutsuEigyosho");
  assert.equal(result.label, "営業所・管理者の要件");
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["全営業所で使用権限の確認・管理者の選任ができています"]);
  assert.deepEqual(result.warnings, []);
});

test("checkKobutsuEigyosho: 営業所が複数件でも全て満たしていれば合格", () => {
  const result = checkKobutsuEigyosho([
    { officeName: "本店", hasLegitimateUsageRight: true, managerName: "山田 太郎", isManagerFullTime: true },
    { officeName: "支店", hasLegitimateUsageRight: true, managerName: "鈴木 花子", isManagerFullTime: true },
  ]);
  assert.equal(result.passed, true);
});

test("checkKobutsuEigyosho: 営業所の使用権限が未確認なら不合格となり、成功メッセージは混入しない", () => {
  const result = checkKobutsuEigyosho([
    { officeName: "本店", hasLegitimateUsageRight: false, managerName: "山田 太郎", isManagerFullTime: true },
  ]);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["本店: 営業所の実在性・使用権限が未確認です"]);
});

test("checkKobutsuEigyosho: 管理者が未選任なら不合格", () => {
  const result = checkKobutsuEigyosho([
    { officeName: "本店", hasLegitimateUsageRight: true, managerName: "", isManagerFullTime: false },
  ]);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("管理者が選任されていません")));
});

test("checkKobutsuEigyosho: 管理者が非常勤の場合は不合格にはせず警告のみ出す", () => {
  const result = checkKobutsuEigyosho([
    { officeName: "本店", hasLegitimateUsageRight: true, managerName: "山田 太郎", isManagerFullTime: false },
  ]);
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("常勤性")));
});

test("checkKobutsuEigyosho: 複数営業所のうち1つでも不合格なら全体が不合格になる", () => {
  const result = checkKobutsuEigyosho([
    { officeName: "本店", hasLegitimateUsageRight: true, managerName: "山田 太郎", isManagerFullTime: true },
    { officeName: "支店", hasLegitimateUsageRight: false, managerName: "鈴木 花子", isManagerFullTime: true },
  ]);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("支店")));
});

test("checkKobutsuEigyosho: 営業所が1件も無ければ不合格になり、key/label/reasons/warningsが厳密に一致する", () => {
  const result = checkKobutsuEigyosho([]);
  assert.equal(result.key, "kobutsuEigyosho");
  assert.equal(result.label, "営業所・管理者の要件");
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["営業所の情報が入力されていません"]);
  assert.deepEqual(result.warnings, []);
});
