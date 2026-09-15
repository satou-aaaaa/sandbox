import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConsistency } from "../src/licenses/construction/eligibility/consistencyChecks.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

/**
 * すべての整合性チェック（FR-6.1〜FR-6.3）に対する単体テスト。
 * ダミーデータのみ使用する（NFR-5）。
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
  assert.match(dupWarnings[0].message, /本店/);
  assert.match(dupWarnings[0].message, /支店/);
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
