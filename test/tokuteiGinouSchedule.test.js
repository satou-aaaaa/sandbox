import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcTokuteiGinouSchedule,
  calcGonenJougenDate,
  checkExceedsGonenJougen,
  resolveGonenJougenGuidance,
} from "../src/licenses/tokutei-ginou/reminders/tokuteiGinouSchedule.js";
import { clearFields, registerField } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";

test("calcGonenJougenDate: 起算日から5年後の日付を計算する", () => {
  assert.equal(calcGonenJougenDate("2026-04-01"), "2031-04-01");
});

test("calcGonenJougenDate: うるう年（2/29起点）を5年後に加算すると2/29が存在しない年になる場合がある", () => {
  // 2024-02-29 + 5年 → 2029年は閏年ではないため、UTC日付計算上は2029-03-01になる
  // （Date.UTCの繰り上がり仕様に基づく近似計算。正確な計算は今後の課題として設計書9章に明記済み）
  const result = calcGonenJougenDate("2024-02-29");
  assert.equal(result, "2029-03-01");
});

test("checkExceedsGonenJougen: 次回更新候補期限が上限を超える場合はexceedsCap=trueになる", () => {
  const result = checkExceedsGonenJougen("2026-04-01", "2031-06-01");
  assert.equal(result.exceedsCap, true);
  assert.equal(result.capDateIso, "2031-04-01");
});

test("checkExceedsGonenJougen: 次回更新候補期限が上限を超えない場合はexceedsCap=falseになる", () => {
  const result = checkExceedsGonenJougen("2026-04-01", "2031-03-01");
  assert.equal(result.exceedsCap, false);
});

test("checkExceedsGonenJougen: 次回更新候補期限がちょうど上限日の場合はexceedsCap=falseになる（境界値）", () => {
  const result = checkExceedsGonenJougen("2026-04-01", "2031-04-01");
  assert.equal(result.exceedsCap, false);
});

test("calcTokuteiGinouSchedule: tokuteiGinouDetail未設定の場合は空配列を返す", () => {
  assert.deepEqual(calcTokuteiGinouSchedule({ licenseId: "既定" }), []);
});

test("calcTokuteiGinouSchedule: expiryDateIsoのみ設定の場合、満了リマインド3件を返す", () => {
  const items = calcTokuteiGinouSchedule({ licenseId: "既定", tokuteiGinouDetail: { fieldKey: "gaishokugyou", expiryDateIso: "2026-12-31" } });
  assert.equal(items.length, 3);
  assert.equal(items[0].type, "zairyu-early-notice");
  assert.equal(items[0].dueDateIso, "2026-10-02");
  assert.equal(items[1].type, "zairyu-prepare");
  assert.equal(items[2].type, "zairyu-deadline");
});

test("calcTokuteiGinouSchedule: cumulativeStayStartDateIsoのみ設定の場合、通算上限警告1件を返す", () => {
  const items = calcTokuteiGinouSchedule({
    licenseId: "既定",
    tokuteiGinouDetail: { fieldKey: "gaishokugyou", cumulativeStayStartDateIso: "2026-04-01" },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "gonen-jougen-keikoku");
  assert.equal(items[0].dueDateIso, "2030-10-03");
});

test("calcTokuteiGinouSchedule: 両方設定の場合、満了リマインド3件+通算上限警告1件の計4件を返す", () => {
  const items = calcTokuteiGinouSchedule({
    licenseId: "既定",
    tokuteiGinouDetail: { fieldKey: "gaishokugyou", expiryDateIso: "2026-12-31", cumulativeStayStartDateIso: "2026-04-01" },
  });
  assert.equal(items.length, 4);
});

test("resolveGonenJougenGuidance: 2号移行対象分野なら移行検討を促す文言を返す", () => {
  clearFields();
  registerField({
    fieldKey: "test-2gou-taisho",
    fieldLabel: "テスト2号対象分野",
    skillTestName: "テスト試験",
    requiresSectorSpecificJapaneseTest: false,
    supportsSpecifiedSkilled2: true,
  });
  const guidance = resolveGonenJougenGuidance("test-2gou-taisho");
  assert.match(guidance, /2号への移行対象/);
  assert.match(guidance, /移行の検討/);
});

test("resolveGonenJougenGuidance: 2号対象外分野なら在留資格の見直しが必要な旨を返す", () => {
  clearFields();
  registerField({
    fieldKey: "test-2gou-taishogai",
    fieldLabel: "テスト2号対象外分野",
    skillTestName: "テスト試験",
    requiresSectorSpecificJapaneseTest: false,
    supportsSpecifiedSkilled2: false,
  });
  const guidance = resolveGonenJougenGuidance("test-2gou-taishogai");
  assert.match(guidance, /2号の制度が無い/);
  assert.match(guidance, /在留資格への変更検討/);
});

test("resolveGonenJougenGuidance: fieldKey未指定・未登録の場合は中立的な文言を返す", () => {
  clearFields();
  assert.match(resolveGonenJougenGuidance(undefined), /分野別運用方針を確認/);
  assert.match(resolveGonenJougenGuidance("no-such-field"), /分野別運用方針を確認/);
});

test("calcTokuteiGinouSchedule: 通算上限警告のラベルに分野別の案内文言が反映される", () => {
  clearFields();
  registerField({
    fieldKey: "gaishokugyou",
    fieldLabel: "外食業",
    skillTestName: "外食業技能測定試験",
    requiresSectorSpecificJapaneseTest: false,
    supportsSpecifiedSkilled2: true,
  });
  const items = calcTokuteiGinouSchedule({
    licenseId: "既定",
    tokuteiGinouDetail: { fieldKey: "gaishokugyou", cumulativeStayStartDateIso: "2026-04-01" },
  });
  assert.match(items[0].label, /2号への移行対象/);
});
