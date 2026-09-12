import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility } from "../src/eligibility/engine.js";
import { registerPrefectureRules, getPrefectureRules, clearPrefectureRules } from "../src/eligibility/prefectureRules.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

// 以降のテストは架空の都道府県名・架空の要件のみを使う。
// 実在する都道府県の実際の法的要件を表すものでは一切ない
// （このファイルの目的は「共通要件＋都道府県固有要件」の合成の仕組みを
// 検証することであり、都道府県固有ルールの具体的な中身は対象都道府県が
// 確定してから別途実装する。docs/DESIGN.md §9参照）。

test.afterEach(() => {
  clearPrefectureRules();
});

test("getPrefectureRules: 未登録の都道府県はundefinedを返す", () => {
  assert.equal(getPrefectureRules("架空県"), undefined);
  assert.equal(getPrefectureRules(undefined), undefined);
});

test("registerPrefectureRules → getPrefectureRules: 登録した関数を取得できる", () => {
  const checkFn = () => [];
  registerPrefectureRules("架空県", checkFn);
  assert.equal(getPrefectureRules("架空県"), checkFn);
});

test("registerPrefectureRules: 同じ都道府県名で再登録すると上書きされる", () => {
  registerPrefectureRules("架空県", () => [{ key: "a", label: "旧ルール", passed: true, reasons: [], warnings: [] }]);
  registerPrefectureRules("架空県", () => [{ key: "b", label: "新ルール", passed: true, reasons: [], warnings: [] }]);
  const result = getPrefectureRules("架空県")(buildSampleApplicantProfile());
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "b");
});

test("evaluateEligibility: prefectureに対応するルールが登録されていれば追加要件として合成される", () => {
  registerPrefectureRules("架空県", () => [
    {
      key: "kakuuKenDokujiYouken",
      label: "架空県独自要件（テスト用のダミー）",
      passed: false,
      reasons: ["これはテスト用の架空の要件です。実在の法的要件ではありません。"],
      warnings: [],
    },
  ]);

  const profile = buildSampleApplicantProfile();
  profile.prefecture = "架空県";
  const result = evaluateEligibility(profile);

  assert.equal(result.checks.length, 6); // 共通5要件 + 都道府県固有1件
  assert.equal(result.eligible, false); // 追加要件が不合格のため全体も不合格になる
  assert.ok(result.blockingIssues.some((issue) => issue.includes("架空県独自要件")));
});

test("evaluateEligibility: prefectureに対応するルールが登録されていなければ共通5要件のみで判定する（既存挙動を維持）", () => {
  const profile = buildSampleApplicantProfile();
  profile.prefecture = "登録されていない架空の都道府県";
  const result = evaluateEligibility(profile);

  assert.equal(result.checks.length, 5);
  assert.equal(result.eligible, true); // sampleProfileは全要件を満たすダミーデータ
});

test("evaluateEligibility: prefecture未入力の場合も共通5要件のみで判定する", () => {
  registerPrefectureRules("架空県", () => [
    { key: "extra", label: "架空要件", passed: false, reasons: [], warnings: [] },
  ]);
  const profile = buildSampleApplicantProfile();
  delete profile.prefecture;
  const result = evaluateEligibility(profile);
  assert.equal(result.checks.length, 5);
});
