import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConsistency } from "../src/licenses/construction/eligibility/consistencyChecks.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

/**
 * すべての整合性チェック（FR-6.1〜FR-6.3）に対する単体テスト。
 * ダミーデータのみ使用する（NFR-5）。
 *
 * 【ミューテーションテストで判明した等価ミュータント（2026年10月・#79）】
 * `checkYearFieldPlausibility`・`checkSenninGijutsushaExclusivity`の
 * `profile.senninGijutsushaList ?? []`を`?? ["Stryker was here"]`に置き換える
 * ミュータントが生存する。フォールバックの配列に文字列1件を混入させても、
 * 文字列には`officeName`・`personName`・`yearsOf*`等のプロパティが存在せず
 * すべて`undefined`になるため、`senninGijutsushaList`が未入力（配列なし）の場合と
 * 観測可能な出力（警告の有無）が一致する。どのような入力を与えても出力が
 * 変わらない等価ミュータントであることを確認済み。
 */

test("クリーンなサンプルプロフィールでは警告が0件", () => {
  const profile = buildSampleApplicantProfile();
  const warnings = checkConsistency(profile);
  assert.equal(warnings.length, 0);
});

test("FR-6.1: 代表者氏名と経営業務管理責任者の氏名が異なると警告が1件出る", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.responsibleName = "田中 次郎"; // representativeNameは「山田 太郎」のまま
  const warnings = checkConsistency(profile);
  const mismatchWarnings = warnings.filter((w) => w.key === "representativeNameMismatch");
  assert.equal(mismatchWarnings.length, 1);
  assert.match(mismatchWarnings[0].message, /山田 太郎/);
  assert.match(mismatchWarnings[0].message, /田中 次郎/);
});

test("FR-6.1: 代表者氏名または経営業務管理責任者氏名が未入力なら警告なし", () => {
  const profile = buildSampleApplicantProfile();
  delete profile.representativeName;
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "representativeNameMismatch").length, 0);
});

test("FR-6.2: 負の実務経験年数は入力ミスの疑いとして警告が出る", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList[0].yearsOfGeneralExperience = -3;
  const warnings = checkConsistency(profile);
  const target = warnings.find((w) => w.key === "senninGijutsushaList[0].yearsOfGeneralExperience");
  assert.ok(target, "対象フィールドの警告が見つかること");
  assert.match(target.message, /-3/);
});

test("FR-6.2: 非現実的に大きい実務経験年数（しきい値超過）は警告が出る", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.yearsAsResponsibleOfficer = 999;
  const warnings = checkConsistency(profile);
  const target = warnings.find((w) => w.key === "keieiGyomuKanri.yearsAsResponsibleOfficer");
  assert.ok(target, "対象フィールドの警告が見つかること");
  assert.match(target.message, /999/);
});

test("FR-6.2: しきい値（80年）ちょうどは警告なし、81年は警告あり（境界値）", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.yearsAsResponsibleOfficer = 80;
  let warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "keieiGyomuKanri.yearsAsResponsibleOfficer").length, 0);

  profile.keieiGyomuKanri.yearsAsResponsibleOfficer = 81;
  warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "keieiGyomuKanri.yearsAsResponsibleOfficer").length, 1);
});

test("FR-6.2: 実務経験年数がNaNなら入力ミスとして扱わない（数値以外は無視する）", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.yearsAsResponsibleOfficer = NaN;
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "keieiGyomuKanri.yearsAsResponsibleOfficer").length, 0);
});

test("FR-6.2: senninGijutsushaListが未入力(undefined)でもエラーにならず警告0件（??の分岐網羅）", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = undefined;
  const warnings = checkConsistency(profile);
  assert.equal(warnings.length, 0);
});

test("FR-6.2: officeNameが未入力の専任技術者の年数エラーは「n件目の営業所」とラベル表示する", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: -1,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  const target = warnings.find((w) => w.key === "senninGijutsushaList[0].yearsOfGeneralExperience");
  // 前方一致で確認する（`index + 1` を `index - 1` に書き換えても「-1件目の営業所」が
  // 部分文字列として`/1件目の営業所/`にマッチしてしまい見逃すため、境界を明示する）。
  assert.match(target.message, /専任技術者（1件目の営業所）/);
  assert.doesNotMatch(target.message, /-1件目/);
});

test("FR-6.2: officeNameが設定されている場合は「{officeName}（n件目）」形式でラベル表示する", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: -1,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  const target = warnings.find((w) => w.key === "senninGijutsushaList[0].yearsOfGeneralExperience");
  assert.match(target.message, /専任技術者（本店（1件目））/);
  assert.doesNotMatch(target.message, /-1件目/);
});

test("FR-6.2: 指定学科卒業者としての実務経験年数が入力ミスの疑いなら専用のキー・ラベルで警告が出る", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList[0].yearsOfPracticalExperience = -2;
  const warnings = checkConsistency(profile);
  const target = warnings.find((w) => w.key === "senninGijutsushaList[0].yearsOfPracticalExperience");
  assert.ok(target, "対象フィールドの警告が見つかること");
  assert.match(target.message, /指定学科卒業者としての実務経験年数/);
  assert.match(target.message, /-2/);
});

test("FR-6.2: 指導監督的実務経験年数が入力ミスの疑いなら専用のキー・ラベルで警告が出る", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList[0].yearsOfSupervisoryExperience = 999;
  const warnings = checkConsistency(profile);
  const target = warnings.find((w) => w.key === "senninGijutsushaList[0].yearsOfSupervisoryExperience");
  assert.ok(target, "対象フィールドの警告が見つかること");
  assert.match(target.message, /指導監督的実務経験年数/);
  assert.match(target.message, /999/);
});

test("FR-6.2: 数値でない値（文字列等）は入力ミスの疑いとして扱わない（typeofチェックの分岐網羅）", () => {
  const profile = buildSampleApplicantProfile();
  profile.keieiGyomuKanri.yearsAsResponsibleOfficer = "10"; // 数値ではなく文字列
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "keieiGyomuKanri.yearsAsResponsibleOfficer").length, 0);
});

test("FR-6.3: 同一人物が異なる2営業所の専任技術者として登録されていると警告が出る", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "支店",
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  const dupWarnings = warnings.filter((w) => w.key === "senninGijutsushaDuplicatePerson");
  assert.equal(dupWarnings.length, 1);
  assert.match(dupWarnings[0].message, /佐藤 一郎/);
  // 営業所名は「、」区切りで列挙される（区切り文字自体の消失を検知するため、
  // 個別のmatchではなく連結済みの部分文字列で検証する）。
  assert.match(dupWarnings[0].message, /本店、支店/);
  assert.match(dupWarnings[0].message, /専任技術者は原則1営業所専任であるため、重複登録でないか行政書士・申請者双方でご確認ください。/);
});

test("FR-6.3: 同一人物でもofficeNameが未入力の重複登録は実在の営業所として数えない（誤検知しない）", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
    {
      // officeName未入力。実在の営業所として数えてはいけない。
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "senninGijutsushaDuplicatePerson").length, 0);
});

test("FR-6.3: personNameが同じ空文字の複数エントリでも、officeNameが異なるからといって誤検知しない", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "支店",
      personName: "",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "senninGijutsushaDuplicatePerson").length, 0);
});

test("FR-6.3: 同一人物でも営業所が1つだけなら警告なし（誤検知しない）", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "senninGijutsushaDuplicatePerson").length, 0);
});

test("FR-6.3: personNameが未入力・空文字の複数営業所では誤検知しない", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "支店",
      personName: "",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "senninGijutsushaDuplicatePerson").length, 0);
});

test("同一人物が異なる営業所名で重複していても、同じ営業所名なら1営業所として扱う（誤検知しない）", () => {
  const profile = buildSampleApplicantProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "本店",
      personName: "佐藤 一郎",
      licenseType: "特定",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 2,
    },
  ];
  const warnings = checkConsistency(profile);
  assert.equal(warnings.filter((w) => w.key === "senninGijutsushaDuplicatePerson").length, 0);
});
