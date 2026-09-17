import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKobutsuConsistency } from "../src/licenses/kobutsu/eligibility/consistencyChecks.js";
import { buildSampleKobutsuProfile } from "../scripts/sampleKobutsuProfile.js";

/**
 * 古物商許可の整合性チェックの単体テスト。建設業許可の
 * consistencyChecks.jsと同じ設計思想（合否判定に影響しない「気づき」情報）。
 * ダミーデータのみ使用する（NFR-5）。
 */

test("クリーンなサンプルプロフィールでは警告が0件", () => {
  const profile = buildSampleKobutsuProfile();
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.length, 0);
});

test("生年月日が未来の日付なら警告が出る", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "2999-01-01";
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "birthDateInFuture");
  assert.ok(target);
  assert.match(target.message, /2999-01-01/);
});

test("生年月日から算出される年齢が120歳を超えると警告が出る", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "1850-01-01";
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "birthDateImplausiblyOld");
  assert.ok(target);
});

test("生年月日が日付として解釈できない場合は警告が出る", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "不明";
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "birthDateUnparseable");
  assert.ok(target);
});

test("生年月日が未入力なら警告なし", () => {
  const profile = buildSampleKobutsuProfile();
  delete profile.birthDate;
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key.startsWith("birthDate")).length, 0);
});

test("同一人物が複数営業所の管理者として登録されていると警告が出る", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList.push({
    officeName: "支店",
    hasLegitimateUsageRight: true,
    managerName: "山田 太郎",
    isManagerFullTime: true,
  });
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "managerDuplicateAcrossOffices");
  assert.ok(target);
  assert.match(target.message, /本店/);
  assert.match(target.message, /支店/);
});

test("異なる管理者が異なる営業所に登録されていれば警告なし", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList.push({
    officeName: "支店",
    hasLegitimateUsageRight: true,
    managerName: "鈴木 花子",
    isManagerFullTime: true,
  });
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "managerDuplicateAcrossOffices").length, 0);
});

test("未成年者の相続人特例がtrueだが未成年者フラグがfalseなら警告が出る", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isHeirWithQualifiedLegalRepresentative = true;
  // isMinorWithoutCapacity は false のまま
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "minorExceptionWithoutMinorFlag");
  assert.ok(target);
});

test("未成年者の相続人特例がtrueかつ未成年者フラグもtrueなら警告なし", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isMinorWithoutCapacity = true;
  profile.kekkaku.isHeirWithQualifiedLegalRepresentative = true;
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "minorExceptionWithoutMinorFlag").length, 0);
});
