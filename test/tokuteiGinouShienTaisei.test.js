import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShienTaisei } from "../src/licenses/tokutei-ginou/eligibility/shienTaisei.js";

// ミューテーションテスト（#79）で生存を確認した等価ミュータント（対応不要）:
// shienTaisei.js:73-74の`uncoveredCount`の算出・ガード条件（`filter((c) => !c).length`→
// `.length`、`uncoveredCount > 0`→`true`/`uncoveredCount >= 0`）は、直後のforEachが
// 各要素を`!covered`で個別に再チェックするため、`uncoveredCount`自体の値や外側のif
// 条件を変えても出力される警告は変わらない（ガードは「全件カバー済みなら走査を
// 省く」最適化のみで、正誤には寄与しない）。

const ALL_COVERED = new Array(10).fill(true);

function baseInput(overrides = {}) {
  return {
    shienMethod: "自社実施",
    hasShienSekininsha: true,
    hasShienTantousha: true,
    hasStaffWithSodanExperience: true,
    canSupportInUnderstandableLanguage: true,
    mandatorySupportItemsCovered: [...ALL_COVERED],
    ...overrides,
  };
}

test("checkShienTaisei: 自社実施で基準を満たす場合のkey・label・reasons・warningsを厳密に確認", () => {
  const result = checkShienTaisei(baseInput());
  assert.equal(result.passed, true);
  assert.equal(result.key, "shienTaisei");
  assert.equal(result.label, "支援計画の実施体制要件");
  assert.deepEqual(result.reasons, ["自社基準を満たしており、支援計画を「自社実施」により実施できます"]);
  assert.deepEqual(result.warnings, []);
});

test("checkShienTaisei: 自社実施で支援責任者が未選任の場合はpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ hasShienSekininsha: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("支援責任者")));
});

test("checkShienTaisei: 自社実施で生活相談経験者が未配置の場合はpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ hasStaffWithSodanExperience: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("生活相談業務")));
});

test("checkShienTaisei: 自社実施で支援担当者が未選任の場合はreasonsに具体的な文言が入り、合格メッセージは含まない", () => {
  const result = checkShienTaisei(baseInput({ hasShienTantousha: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes("支援担当者が選任されていません"));
  assert.ok(!result.reasons.some((r) => r.includes("自社基準を満たしており")));
});

test("checkShienTaisei: 自社実施で多言語対応体制が未確認の場合はreasonsに具体的な文言が入る", () => {
  const result = checkShienTaisei(baseInput({ canSupportInUnderstandableLanguage: false }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes("外国人が理解できる言語での支援体制が確認できていません"));
});

test("checkShienTaisei: 全部委託で委託先の登録支援機関名が記入済みならpassed=trueになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "全部委託", registeredSupportOrgName: "サンプル登録支援機関" }));
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("登録支援機関として有効に登録")));
});

test("checkShienTaisei: 全部委託で委託先名が記入済みの場合のreasonsを厳密に確認", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "全部委託", registeredSupportOrgName: "サンプル登録支援機関" }));
  assert.deepEqual(result.reasons, ["支援計画は登録支援機関「サンプル登録支援機関」への全部委託により実施します"]);
});

test("checkShienTaisei: 全部委託で委託先の登録支援機関名が未記入ならpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "全部委託" }));
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("登録支援機関名が未記入")));
});

test("checkShienTaisei: 一部委託で自社基準を満たす場合はpassed=trueになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託", registeredSupportOrgName: "サンプル登録支援機関" }));
  assert.equal(result.passed, true);
});

test("checkShienTaisei: 一部委託で委託先名が記入済みの場合は委託先未記入の警告が出ない", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託", registeredSupportOrgName: "サンプル登録支援機関" }));
  assert.ok(!result.warnings.some((w) => w.includes("一部委託の方針ですが")));
});

test("checkShienTaisei: 自社実施で委託先名が未記入でも一部委託向けの警告は出ない", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "自社実施" }));
  assert.ok(!result.warnings.some((w) => w.includes("一部委託の方針ですが")));
});

test("checkShienTaisei: 一部委託で自社基準を満たさない場合はpassed=falseになる", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託", hasShienTantousha: false }));
  assert.equal(result.passed, false);
});

test("checkShienTaisei: 一部委託で委託先名が未記入の場合は警告が出る（合否には影響しない）", () => {
  const result = checkShienTaisei(baseInput({ shienMethod: "一部委託" }));
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.includes("委託先の登録支援機関名が未記入")));
});

test("checkShienTaisei: 義務的支援10項目のうち一部が未カバーの場合、その項目分だけ警告が出る", () => {
  const covered = [...ALL_COVERED];
  covered[0] = false;
  covered[5] = false;
  const result = checkShienTaisei(baseInput({ mandatorySupportItemsCovered: covered }));
  const supportWarnings = result.warnings.filter((w) => w.includes("義務的支援10項目"));
  assert.equal(supportWarnings.length, 2);
  assert.ok(supportWarnings.some((w) => w.includes("事前ガイダンスの提供")));
  assert.ok(supportWarnings.some((w) => w.includes("日本語学習機会の提供")));
});

test("checkShienTaisei: 義務的支援10項目が全てカバーされていれば警告が出ない", () => {
  const result = checkShienTaisei(baseInput());
  assert.equal(result.warnings.filter((w) => w.includes("義務的支援10項目")).length, 0);
});

test("checkShienTaisei: 義務的支援10項目が全て未カバーの場合、10項目すべての具体的な文言が警告に入る", () => {
  const result = checkShienTaisei(baseInput({ mandatorySupportItemsCovered: new Array(10).fill(false) }));
  const supportWarnings = result.warnings.filter((w) => w.includes("義務的支援10項目"));
  assert.equal(supportWarnings.length, 10);
  for (const label of [
    "事前ガイダンスの提供",
    "出入国時の送迎",
    "住居確保・生活契約支援",
    "生活オリエンテーションの実施",
    "公的手続への同行",
    "日本語学習機会の提供",
    "相談・苦情への対応",
    "日本人との交流促進",
    "転職支援（受入れ機関都合の離職時）",
    "定期的な面談・行政機関への通報",
  ]) {
    assert.ok(supportWarnings.some((w) => w.includes(label)), `「${label}」を含む警告が無い`);
  }
});
