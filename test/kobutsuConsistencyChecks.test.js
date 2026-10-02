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

test("生年月日から算出される年齢が120歳を超えると警告が出て、メッセージが完全に一致する", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "1850-01-01";
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "birthDateImplausiblyOld");
  assert.ok(target);
  assert.equal(
    target.message,
    "生年月日（1850-01-01）から算出される年齢が120歳を超えており、入力ミスの疑いがあります。ご確認ください。"
  );
});

test("生年月日が日付として解釈できない場合は警告が出て、メッセージが完全に一致する", () => {
  const profile = buildSampleKobutsuProfile();
  profile.birthDate = "不明";
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "birthDateUnparseable");
  assert.ok(target);
  assert.equal(target.message, "生年月日（不明）を日付として解釈できません。入力形式（YYYY-MM-DD）をご確認ください。");
});

test("生年月日が未入力なら警告なし", () => {
  const profile = buildSampleKobutsuProfile();
  delete profile.birthDate;
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key.startsWith("birthDate")).length, 0);
});

test("同一人物が複数営業所の管理者として登録されていると警告が出て、メッセージが完全に一致する", () => {
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
  assert.equal(
    target.message,
    "山田 太郎 が複数の営業所（本店、支店）の管理者として登録されています。" +
      "管理者は各営業所の業務を適正に実施する責任者（古物営業法第13条第1項）であるため、" +
      "実態として複数営業所の職務を果たせる体制になっているか、念のためご確認ください。"
  );
});

test("営業所名が未入力の営業所は、管理者の重複カウントに含めない", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList = [
    { officeName: "", hasLegitimateUsageRight: true, managerName: "山田 太郎", isManagerFullTime: true },
    { officeName: "支店", hasLegitimateUsageRight: true, managerName: "山田 太郎", isManagerFullTime: true },
  ];
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "managerDuplicateAcrossOffices").length, 0);
});

test("管理者が未選任の営業所は、重複カウントの対象から除外される（eigyosho.js側の要件判定とは独立）", () => {
  const profile = buildSampleKobutsuProfile();
  profile.eigyoshoList = [
    { officeName: "本店", hasLegitimateUsageRight: true, managerName: "", isManagerFullTime: false },
    { officeName: "支店", hasLegitimateUsageRight: true, managerName: "", isManagerFullTime: false },
  ];
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "managerDuplicateAcrossOffices").length, 0);
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

test("未成年者の相続人特例がtrueだが未成年者フラグがfalseなら警告が出て、メッセージが完全に一致する", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isHeirWithQualifiedLegalRepresentative = true;
  // isMinorWithoutCapacity は false のまま
  const warnings = checkKobutsuConsistency(profile);
  const target = warnings.find((w) => w.key === "minorExceptionWithoutMinorFlag");
  assert.ok(target);
  assert.equal(
    target.message,
    "「未成年者の相続人特例（法定代理人が欠格事由に該当しない場合の例外）」がtrueですが、" +
      "「未成年者で行為能力を有しない」がfalse（または未入力）になっています。" +
      "この例外は申請者本人が未成年者である場合にのみ意味を持つため、入力の取り違えがないかご確認ください。"
  );
});

test("未成年者の相続人特例がtrueかつ未成年者フラグもtrueなら警告なし", () => {
  const profile = buildSampleKobutsuProfile();
  profile.kekkaku.isMinorWithoutCapacity = true;
  profile.kekkaku.isHeirWithQualifiedLegalRepresentative = true;
  const warnings = checkKobutsuConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "minorExceptionWithoutMinorFlag").length, 0);
});

/**
 * 【ミューテーションテストで判明した、実務上テストできない／等価なミュータント（2026年10月・#79）】
 *
 * 1. `checkBirthDatePlausibility`の`birth.getTime() > now.getTime()`を`>=`に、
 *    `ageYears > MAX_PLAUSIBLE_AGE_YEARS`を`>=`に置き換えるミュータントが生存する。
 *    どちらも「入力された生年月日から算出される値が、関数内部で取得する
 *    `new Date()`（現在時刻）とミリ秒単位で完全一致する」場合にのみ結果が
 *    変わる境界値だが、現在時刻を注入可能にする仕組み（クロックの依存性注入）を
 *    本関数は持たない。テスト実行のたびに変化する現在時刻と、浮動小数点の
 *    年数計算の結果が厳密に一致する入力を安定して再現することはできないため、
 *    対応を見送る。
 *
 * 2. `checkManagerDuplicateAcrossOffices`の`profile.eigyoshoList ?? []`を
 *    `?? ["Stryker was here"]`に置き換えるミュータントが生存する。この分岐に
 *    到達するのは`eigyoshoList`が未設定の場合のみで、注入される値は文字列
 *    （オブジェクトではない）である。直後の`if (!office.managerName) continue;`で
 *    文字列の`.managerName`プロパティは常に`undefined`になるため、フォールバック
 *    配列の中身が空配列か1件のダミー文字列かに関わらず、ループ本体は必ず
 *    `continue`され実質的に何も処理しない。したがって挙動に差が出ない等価
 *    ミュータントと判断した。
 */
