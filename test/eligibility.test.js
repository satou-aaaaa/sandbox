import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility, formatEligibilityReport } from "../src/licenses/construction/eligibility/engine.js";

/**
 * 【ミューテーションテストで判明した等価ミュータント・対応見送り（2026年10月・#79）】
 * - `kekkaku.js`の`for (const officer of officers ?? [])`・
 *   `for (const employee of regulatoryEmployees ?? [])`で、デフォルト値の
 *   `[]`を`["Stryker was here"]`に置き換えるミュータントが生存する。
 *   `officers`/`regulatoryEmployees`が`undefined`のときのみこのデフォルト値が
 *   使われるが、配列の要素が文字列（`.kekkaku`プロパティを持たない）であっても
 *   `buildPersonFlags`は`person`を欠格情報オブジェクトとして扱えず早期リターン
 *   するため、挙動は変わらない等価ミュータントである（古物商`kekkaku.js`の
 *   同種の対応と同じ判断）。
 * - `seijitsusei.js`の`label: "誠実性"`と、合格時に必ず表示される警告文
 *   （行政書士本人による個別確認を促す固定文言）は、埋め込み値を含まない
 *   静的な文字列であり、判定結果（合否）には影響しない。ADR-0011の既定方針
 *   （判定結果に影響しない文言の変化は対応を見送る）に従い、対応していない。
 */

/** @returns {import('../src/licenses/construction/eligibility/types.js').ApplicantProfile} */
function baseProfile() {
  return {
    applicantName: "テスト建設株式会社",
    keieiGyomuKanri: {
      yearsAsResponsibleOfficer: 5,
      yearsAsQuasiResponsibleOfficer: 0,
      yearsAsAssistant: 0,
      isOfficerFor2Years: false,
      assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
      hasSocialInsurance: true,
    },
    senninGijutsushaList: [
      {
        officeName: "本店",
        licenseType: "一般",
        hasNationalLicense: true,
        isDesignatedCourseGraduate: false,
        educationLevel: null,
        yearsOfPracticalExperience: 0,
        yearsOfGeneralExperience: 0,
        yearsOfSupervisoryExperience: 0,
      },
    ],
    zaisanKiso: {
      licenseType: "一般",
      netAssets: 6_000_000,
      fundingCapacity: 0,
      hasFiveYearsContinuousOperation: false,
      capitalAmount: 0,
      deficitRatio: 0,
      currentRatio: 0,
    },
    kekkaku: {
      isUndischargedBankrupt: false,
      hadLicenseRevokedWithin5Years: false,
      hasCriminalRecordWithin5Years: false,
      isBoryokudanMemberOrWithin5Years: false,
      hasMentalImpairmentAffectingDuties: false,
      hasFalseOrOmittedStatement: false,
    },
    seijitsusei: { hasNoDishonestActRisk: true },
  };
}

test("全要件を満たす標準ケースは eligible = true", () => {
  const result = evaluateEligibility(baseProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 5);

  const keiei = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(keiei.label, "経営業務の管理を適正に行う体制");
  assert.deepEqual(keiei.reasons, ["経営業務管理責任者としての経験 5年（5年以上）でルートA該当"]);
  assert.deepEqual(keiei.warnings, []);

  const kekkaku = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(kekkaku.label, "欠格要件に該当しないこと");
  assert.deepEqual(kekkaku.reasons, [
    "欠格要件（建設業法第8条各号: 破産・許可取消歴・駆け込み廃業・営業停止/禁止処分中・刑罰・" +
      "暴力団関係・心身の故障・虚偽記載、および役員等・政令使用人・法定代理人の欠格〈入力がある範囲〉）" +
      "のいずれにも該当しません",
  ]);
  assert.deepEqual(kekkaku.warnings, []);
});

test("経営業務管理体制: 社会保険未加入なら不合格", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri.hasSocialInsurance = false;
  const result = evaluateEligibility(profile);
  assert.equal(result.eligible, false);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, false);
});

test("経営業務管理体制: ルートD（複合要件）でも合格できる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: true,
    assistantSupportYears: { finance: 5, labor: 5, operations: 5 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["役員等2年以上 + 財務・労務・運営の補佐者を各5年以上配置でルートD該当"]);
  assert.deepEqual(check.warnings, [
    "ルートDは複合要件のため、財務・労務・運営それぞれの補佐者の在籍を証明する書類（組織図・辞令等）を別途準備してください",
  ]);
});

test("経営業務管理体制: ルートD判定でisOfficerFor2YearsがtrueでもassistantSupportYearsが未入力(undefined)なら、既定値0として扱われルートD不成立になる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: true,
    hasSocialInsurance: true,
    // assistantSupportYears を意図的に省略
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, false);
});

test("経営業務管理体制: assistantSupportYearsが未入力(undefined)でもルートAの判定はエラーにならない（||の分岐網羅）", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 5,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: false,
    hasSocialInsurance: true,
    // assistantSupportYears を意図的に省略
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true); // ルートA（5年以上）で合格するはず
});

test("経営業務管理体制: ルートA〜Dのいずれも不成立かつ社会保険未加入なら、両方の理由が含まれ不合格になる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: false,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("いずれも基準年数に達していません")));
  assert.ok(check.reasons.some((r) => r.includes("健康保険")));
});

test("経営業務管理体制: ルートD（複合要件）は4条件すべてが必要で、1つでも基準未満なら不成立になる（境界値・4パターン）", () => {
  const base = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
  };
  const cases = [
    { isOfficerFor2Years: false, assistantSupportYears: { finance: 5, labor: 5, operations: 5 } }, // 役員等2年以上を満たさない
    { isOfficerFor2Years: true, assistantSupportYears: { finance: 4, labor: 5, operations: 5 } }, // 財務が基準未満
    { isOfficerFor2Years: true, assistantSupportYears: { finance: 5, labor: 4, operations: 5 } }, // 労務が基準未満
    { isOfficerFor2Years: true, assistantSupportYears: { finance: 5, labor: 5, operations: 4 } }, // 運営が基準未満
  ];
  for (const c of cases) {
    const profile = baseProfile();
    profile.keieiGyomuKanri = { ...base, ...c, hasSocialInsurance: true };
    const result = evaluateEligibility(profile);
    const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
    assert.equal(check.passed, false, `case=${JSON.stringify(c)}`);
  }
});

test("専任技術者: 実務経験10年ルートで合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["[本店] 実務経験 10年（10年以上）で要件を満たします"]);
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: 実務経験は9年（10年未満）では合格できない（境界値）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 9,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
  assert.deepEqual(check.reasons, [
    "[本店] 国家資格・指定学科卒業+実務経験・実務経験10年のいずれの基準も満たしていません",
  ]);
  assert.deepEqual(check.warnings, []);
});

test("専任技術者: 指定学科卒業者でも学歴区分が「高卒」「大卒」いずれにも一致しなければ、実務経験年数に関わらず不合格（学歴区分の判定が実質チェックされていることの確認）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "中卒", // 「高卒」でも「大卒」でもない
      yearsOfPracticalExperience: 10, // 高卒(5年)・大卒(3年)いずれの基準も上回るが、学歴区分自体が一致しない
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
});

test("専任技術者: 大卒でも実務経験2年（3年未満）では合格できない（境界値。高卒ルートの基準値と混同していないことの確認）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "大卒",
      yearsOfPracticalExperience: 2, // 大卒ルートの基準（3年）未満
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
});

test("専任技術者: 指定学科卒業者でなければ、学歴区分・実務経験年数が基準を満たしていても不合格（isDesignatedCourseGraduateが独立した必須条件であることの確認）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false, // 指定学科卒業ではない
      educationLevel: "高卒",
      yearsOfPracticalExperience: 10,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
});

test("専任技術者: 特定建設業でも指導監督的実務経験2年以上あれば合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 2,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, [
    "[本店] 実務経験 10年（10年以上）で要件を満たします",
    "[本店] 指導監督的実務経験 2年（2年以上）で特定建設業の追加要件も満たします",
  ]);
});

test("専任技術者: 特定建設業は指導監督的実務経験2年も必要", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 1, // 2年未満
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
  assert.deepEqual(check.reasons, [
    "[本店] 実務経験 10年（10年以上）で要件を満たします",
    "[本店] 特定建設業は上記に加えて、4,500万円以上の工事における指導監督的実務経験2年以上（または該当する国家資格）が必要ですが、確認できていません",
  ]);
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 特定建設業は3条件すべて必要", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 45_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 25_000_000,
    deficitRatio: 10,
    currentRatio: 60, // 75%未満で不合格
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
});

test("欠格要件: 暴力団関係者は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.isBoryokudanMemberOrWithin5Years = true;
  const result = evaluateEligibility(profile);
  assert.equal(result.eligible, false);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(result.blockingIssues.some((i) => i.includes("暴力団")));
});

test("誠実性: 自己申告で懸念ありなら不合格", () => {
  const profile = baseProfile();
  profile.seijitsusei = { hasNoDishonestActRisk: false, notes: "過去に指名停止歴あり、要確認" };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.equal(check.passed, false);
  assert.equal(check.reasons[0], "自己申告で、不正・不誠実な行為のおそれに関する懸念が申告されています");
});

test("誠実性: 申告メモがあれば判定理由に含まれる", () => {
  const profile = baseProfile();
  profile.seijitsusei = { hasNoDishonestActRisk: true, notes: "特記事項なし" };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.ok(check.reasons.some((r) => r.includes("特記事項なし")));
});

test("誠実性: 合格時も行政書士本人による個別確認を促す警告が必ず表示される", () => {
  const profile = baseProfile();
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.equal(check.passed, true);
  assert.ok(check.warnings.length > 0);
  // notesが未入力(baseProfile)なら、申告メモの理由は追加されず1件のみになる
  assert.deepEqual(check.reasons, ["自己申告上、不正・不誠実な行為をするおそれがある事実は確認されていません"]);
});

test("財産的基礎: 一般建設業は自己資本500万円ちょうどで要件を満たす（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 5_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["自己資本 5,000,000円 が500万円以上で要件を満たします"]);
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 一般建設業は自己資本499万9999円では単独では要件を満たさない（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 4_999_999,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
});

test("財産的基礎: 一般建設業は資金調達能力500万円以上のみでも要件を満たす", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 5_000_000,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["資金調達能力 5,000,000円 が500万円以上で要件を満たします"]);
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 一般建設業は直近5年間の継続営業実績のみでも要件を満たす", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: true,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["直近5年間、許可を受けて継続して営業した実績があり要件を満たします"]);
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 一般建設業は3ルートいずれも満たさなければ不合格", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
  assert.deepEqual(check.reasons, [
    "自己資本500万円以上・資金調達能力500万円以上・5年間の継続営業実績のいずれも確認できません",
  ]);
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 一般建設業は資金調達能力500万円ちょうどで要件を満たし、499万9999円では満たさない（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 5_000_000,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  let result = evaluateEligibility(profile);
  assert.equal(result.checks.find((c) => c.key === "zaisanKiso").passed, true);

  profile.zaisanKiso.fundingCapacity = 4_999_999;
  result = evaluateEligibility(profile);
  assert.equal(result.checks.find((c) => c.key === "zaisanKiso").passed, false);
});

test("財産的基礎: 特定建設業は欠損比率・流動比率・資本金/自己資本の3条件すべて満たせば合格する", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 40_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 20_000_000,
    deficitRatio: 20,
    currentRatio: 75,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, true);
  assert.equal(check.label, "財産的基礎（金銭的信用）");
  assert.ok(check.reasons.every((r) => r.includes("条件クリア")));
  assert.deepEqual(check.warnings, [
    "特定建設業は上記3条件を「すべて」満たす必要があります（一般建設業のような選択制ではありません）",
  ]);
});

test("財産的基礎: 特定建設業の欠損比率は20%ちょうどで条件クリア、21%では未達（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 40_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 20_000_000,
    deficitRatio: 20,
    currentRatio: 75,
  };
  let result = evaluateEligibility(profile);
  assert.equal(result.checks.find((c) => c.key === "zaisanKiso").passed, true);

  profile.zaisanKiso.deficitRatio = 21;
  result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("欠損比率") && r.includes("超えています")));
});

test("財産的基礎: 特定建設業の流動比率は75%ちょうどで条件クリア、74%では未達（境界値）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 40_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 20_000_000,
    deficitRatio: 20,
    currentRatio: 75,
  };
  let result = evaluateEligibility(profile);
  assert.equal(result.checks.find((c) => c.key === "zaisanKiso").passed, true);

  profile.zaisanKiso.currentRatio = 74;
  result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("流動比率") && r.includes("未満")));
});

test("財産的基礎: 特定建設業は資本金2000万円以上『かつ』自己資本4000万円以上の両方が必要（片方だけでは不合格）", () => {
  const profile = baseProfile();
  // 自己資本は基準を大きく超えるが、資本金が基準未満（境界値-1円）→ 不合格になるはず
  // （AND条件がORに壊れていないことを確認する）
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 100_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 19_999_999,
    deficitRatio: 0,
    currentRatio: 100,
  };
  let result = evaluateEligibility(profile);
  let check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some((r) =>
      r.includes("資本金または自己資本が基準（資本金2,000万円以上かつ自己資本4,000万円以上）に達していません")
    )
  );

  // 逆に資本金は基準を大きく超えるが、自己資本が基準未満（境界値-1円）→ こちらも不合格
  profile.zaisanKiso.capitalAmount = 100_000_000;
  profile.zaisanKiso.netAssets = 39_999_999;
  result = evaluateEligibility(profile);
  check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some((r) =>
      r.includes("資本金または自己資本が基準（資本金2,000万円以上かつ自己資本4,000万円以上）に達していません")
    )
  );
});

test("専任技術者: 国家資格保有のみでも合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["[本店] 該当する国家資格等の保有により要件を満たします"]);
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: 指定学科卒業（高卒）+ 実務経験5年で合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "高卒",
      yearsOfPracticalExperience: 5,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["[本店] 指定学科卒業（高卒）+ 実務経験 5年で要件を満たします"]);
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: 指定学科卒業（高卒）でも実務経験4年では合格できない（境界値）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "高卒",
      yearsOfPracticalExperience: 4,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
});

test("専任技術者: 指定学科卒業（大卒）+ 実務経験3年で合格できる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "大卒",
      yearsOfPracticalExperience: 3,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, true);
});

test("専任技術者: 複数営業所のうち1つでも不合格なら全体が不合格になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "支店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
  assert.equal(check.label, "営業所ごとの専任技術者の配置");
  assert.ok(check.reasons.some((r) => r.includes("[支店]")));
  // 本店（合格・警告あり）と支店（不合格・警告なし）の警告が、flatMapで正しく集約されていることの確認
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: 営業所が1つも登録されていなければ不合格になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.passed, false);
  assert.equal(check.label, "営業所ごとの専任技術者の配置");
  assert.ok(check.reasons.some((r) => r.includes("営業所の情報が入力されていません")));
  assert.deepEqual(check.warnings, []);
});

test("経営業務管理体制: ルートB（準ずる地位5年）でも合格できる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 5,
    yearsAsAssistant: 0,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["準ずる地位での経験 5年（5年以上）でルートB該当"]);
  assert.deepEqual(check.warnings, []);
});

test("経営業務管理体制: ルートC（補佐業務6年）でも合格できる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 6,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, true);
  assert.deepEqual(check.reasons, ["補佐業務での経験 6年（6年以上）でルートC該当"]);
  assert.deepEqual(check.warnings, []);
});

test("経営業務管理体制: 補佐業務5年（6年未満）ではルートC不成立（境界値）", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 5,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.passed, false);
});

test("欠格要件: 破産者で復権を得ていない場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.isUndischargedBankrupt = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("破産者")));
});

test("欠格要件: 5年以内に建設業許可を取り消された経験がある場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hadLicenseRevokedWithin5Years = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("許可を取り消された")));
});

test("欠格要件: 拘禁刑以上の刑等から5年を経過していない場合は不合格（令和7年6月1日施行の現行用語。「禁錮」ではない）", () => {
  const profile = baseProfile();
  profile.kekkaku.hasCriminalRecordWithin5Years = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("拘禁刑以上の刑")));
});

test("欠格要件: 許可取消しの聴聞通知後の駆け込み廃業から5年を経過していない場合は不合格（建設業法第8条第3号）", () => {
  const profile = baseProfile();
  profile.kekkaku.hasWithdrawnLicenseDuringRevocationHearingWithin5Years = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("廃業届出")));
});

test("欠格要件: 営業停止命令の停止期間が経過していない場合は不合格（建設業法第8条第5号）", () => {
  const profile = baseProfile();
  profile.kekkaku.hasBusinessSuspensionOrderInEffect = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("営業停止命令")));
});

test("欠格要件: 営業禁止処分の禁止期間が経過していない場合は不合格（建設業法第8条第6号）", () => {
  const profile = baseProfile();
  profile.kekkaku.hasBusinessProhibitionOrderInEffect = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("営業禁止処分")));
});

test("欠格要件: 暴力団員等がその事業活動を支配する者である場合は不合格（建設業法第8条第14号）", () => {
  const profile = baseProfile();
  profile.kekkaku.isControlledByBoryokudanMember = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("事業活動を支配")));
});

test("欠格要件: 心身の故障により適正に営むことができないと認められる場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hasMentalImpairmentAffectingDuties = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("心身の故障")));
});

test("欠格要件: 虚偽記載・重要事実の記載漏れがある場合は不合格", () => {
  const profile = baseProfile();
  profile.kekkaku.hasFalseOrOmittedStatement = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("虚偽の記載")));
});

test("欠格要件: 取消し通知前60日以内に役員等であった場合は不合格（建設業法第8条第4号）", () => {
  const profile = baseProfile();
  profile.kekkaku.hasRevocationNoticeWithin60DaysAsOfficer = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("第4号")));
});

test("欠格要件: 未成年者の法定代理人が欠格事由に該当する場合は不合格（建設業法第8条第11号）", () => {
  const profile = baseProfile();
  profile.kekkaku.isMinor = true;
  profile.kekkaku.legalRepresentativeName = "山田 一郎";
  profile.kekkaku.legalRepresentativeKekkaku = { isUndischargedBankrupt: true };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("法定代理人（山田 一郎）") && r.includes("第十一号")));
});

test("欠格要件: 未成年者の法定代理人の氏名が未入力でも、肩書き「法定代理人」のみで理由文に出る（氏名未入力のフォールバック表記）", () => {
  const profile = baseProfile();
  profile.kekkaku.isMinor = true;
  profile.kekkaku.legalRepresentativeKekkaku = { isUndischargedBankrupt: true };
  // legalRepresentativeName を意図的に省略
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r === "欠格要件に該当: 法定代理人が破産者で復権を得ていません（第十一号）"));
});

test("欠格要件: 法定代理人・役員・政令で定める使用人の欠格事由は、本人分と同じ8項目すべてを個別に判定する（未入力項目があっても他項目は機能することの確認）", () => {
  const profile = baseProfile();
  profile.kekkaku.isMinor = true;
  profile.kekkaku.legalRepresentativeName = "山田 一郎";
  profile.kekkaku.legalRepresentativeKekkaku = { hadLicenseRevokedWithin5Years: true };
  let result = evaluateEligibility(profile);
  let check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some(
      (r) => r === "欠格要件に該当: 法定代理人（山田 一郎）が5年以内に建設業許可を取り消された経験があります（第十一号）"
    )
  );

  profile.kekkaku.legalRepresentativeKekkaku = {
    hasWithdrawnLicenseDuringRevocationHearingWithin5Years: true,
  };
  result = evaluateEligibility(profile);
  check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some(
      (r) =>
        r ===
        "欠格要件に該当: 法定代理人（山田 一郎）が許可取消しの聴聞通知後、取消しを免れるため廃業届出をしてから5年を経過していません（第十一号）"
    )
  );

  profile.kekkaku.legalRepresentativeKekkaku = { hasRevocationNoticeWithin60DaysAsOfficer: true };
  result = evaluateEligibility(profile);
  check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some(
      (r) =>
        r === "欠格要件に該当: 法定代理人（山田 一郎）が許可取消しの聴聞通知前60日以内に当該法人の役員等でした（第十一号）"
    )
  );

  profile.kekkaku.legalRepresentativeKekkaku = { hasBusinessProhibitionOrderInEffect: true };
  result = evaluateEligibility(profile);
  check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some((r) => r === "欠格要件に該当: 法定代理人（山田 一郎）が営業禁止処分の禁止期間中です（第十一号）")
  );
});

test("欠格要件: 未成年者だが法定代理人の欠格事由が未入力の場合は合格扱いにせず警告を出す（第11号）", () => {
  const profile = baseProfile();
  profile.kekkaku.isMinor = true;
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, true);
  assert.ok(check.warnings.some((w) => w.includes("法定代理人") && w.includes("第十一号")));
});

test("欠格要件: 法人役員が欠格事由に該当する場合は不合格（建設業法第8条第12号）", () => {
  const profile = baseProfile();
  profile.officers = [
    { name: "鈴木 花子", title: "取締役", kekkaku: { hasCriminalRecordWithin5Years: true } },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("役員（鈴木 花子）") && r.includes("第十二号")));
});

test("欠格要件: 役員がいるが欠格事由が未入力の場合は合格扱いにせず警告を出す（第12号）", () => {
  const profile = baseProfile();
  profile.officers = [{ name: "鈴木 花子", title: "取締役" }];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, true);
  assert.ok(check.warnings.some((w) => w.includes("役員") && w.includes("第十二号")));
});

test("欠格要件: 役員の一部だけでも欠格事由が入力済みなら、「全員未入力」の警告は出さない（everyで全件未入力を判定。一部入力ありをsomeと混同していないことの確認）", () => {
  const profile = baseProfile();
  profile.officers = [
    { name: "鈴木 花子", title: "取締役", kekkaku: { hasCriminalRecordWithin5Years: false } },
    { name: "佐藤 一郎", title: "監査役" }, // この役員は欠格事由が未入力
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, true);
  assert.ok(!check.warnings.some((w) => w.includes("役員") && w.includes("第十二号")));
});

test("欠格要件: 政令で定める使用人の一部だけでも欠格事由が入力済みなら、「全員未入力」の警告は出さない（everyで全件未入力を判定）", () => {
  const profile = baseProfile();
  profile.regulatoryEmployees = [
    { name: "田中 次郎", kekkaku: { isBoryokudanMemberOrWithin5Years: false } },
    { name: "高橋 三郎" }, // この使用人は欠格事由が未入力
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, true);
  assert.ok(!check.warnings.some((w) => w.includes("政令で定める使用人")));
});

test("欠格要件: 政令で定める使用人（法人）が欠格事由に該当する場合は不合格（建設業法第8条第12号）", () => {
  const profile = baseProfile();
  profile.applicantType = "法人";
  profile.regulatoryEmployees = [
    { name: "田中 次郎", title: "大阪支店長", kekkaku: { isBoryokudanMemberOrWithin5Years: true } },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("政令で定める使用人（田中 次郎）") && r.includes("第十二号")));
});

test("欠格要件: 政令で定める使用人（個人事業主）が欠格事由に該当する場合は不合格（建設業法第8条第13号）", () => {
  const profile = baseProfile();
  profile.applicantType = "個人";
  profile.regulatoryEmployees = [
    { name: "田中 次郎", kekkaku: { hasMentalImpairmentAffectingDuties: true } },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("政令で定める使用人（田中 次郎）") && r.includes("第十三号")));
});

test("欠格要件: 政令で定める使用人がいるが欠格事由が未入力の場合は合格扱いにせず警告を出す（第12号・第13号）", () => {
  const profile = baseProfile();
  profile.regulatoryEmployees = [{ name: "田中 次郎" }];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, true);
  assert.ok(check.warnings.some((w) => w.includes("政令で定める使用人")));
});

test("formatEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = baseProfile();
  const result = evaluateEligibility(profile);
  const report = formatEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  assert.ok(!report.includes("未充足の要因まとめ"));
});

test("formatEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  const profile = baseProfile();
  profile.kekkaku.isBoryokudanMemberOrWithin5Years = true;
  const result = evaluateEligibility(profile);
  const report = formatEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
  assert.match(report, /暴力団/);
});

test("formatEligibilityReport: 入力内容の整合性チェックで警告があれば確認事項として出力される（合否には影響しない）", () => {
  const profile = baseProfile();
  profile.representativeName = "山田 太郎";
  profile.keieiGyomuKanri.responsibleName = "鈴木 次郎"; // 代表者氏名と不一致（FR-6.1）
  const result = evaluateEligibility(profile);
  const report = formatEligibilityReport(profile, result);
  assert.equal(result.eligible, true); // 整合性チェックの警告は合否に影響しない
  assert.match(report, /総合判定: ○/);
  assert.match(report, /入力内容の確認事項/);
  assert.match(report, /山田 太郎/);
});

// 【ミューテーションテストカバレッジ強化（2026年10月・#79優先度A: 建設業5要件）】
// 以下は、reasons/warnings/labelの内容を`.some(includes)`による部分一致ではなく
// `deepEqual`で厳密に検証するテスト。既存テストは「合否(passed)」の検証が中心で、
// 理由・警告の文言そのもの（空文字化・余計な要素の混入・他ルートの文言の漏れ込み等の
// ミュータント）までは検知できていなかった。

test("経営業務管理体制: ルートAのみ該当する場合、label・理由・警告が厳密にルートAのものだけになる", () => {
  const result = evaluateEligibility(baseProfile());
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.equal(check.label, "経営業務の管理を適正に行う体制");
  assert.deepEqual(check.reasons, ["経営業務管理責任者としての経験 5年（5年以上）でルートA該当"]);
  assert.deepEqual(check.warnings, []);
});

test("経営業務管理体制: ルートB（準ずる地位5年）のみ該当する場合、理由が厳密にルートBのものだけになる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 5,
    yearsAsAssistant: 0,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.deepEqual(check.reasons, ["準ずる地位での経験 5年（5年以上）でルートB該当"]);
  assert.deepEqual(check.warnings, []);
});

test("経営業務管理体制: ルートC（補佐業務6年）のみ該当する場合、理由が厳密にルートCのものだけになる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 6,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.deepEqual(check.reasons, ["補佐業務での経験 6年（6年以上）でルートC該当"]);
  assert.deepEqual(check.warnings, []);
});

test("経営業務管理体制: ルートD合格時は理由・警告の文言が厳密にルートDのものだけになる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: true,
    assistantSupportYears: { finance: 5, labor: 5, operations: 5 },
    hasSocialInsurance: true,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.deepEqual(check.reasons, ["役員等2年以上 + 財務・労務・運営の補佐者を各5年以上配置でルートD該当"]);
  assert.deepEqual(check.warnings, [
    "ルートDは複合要件のため、財務・労務・運営それぞれの補佐者の在籍を証明する書類（組織図・辞令等）を別途準備してください",
  ]);
});

test("経営業務管理体制: ルートA〜Dすべて不成立かつ社会保険未加入の場合、理由が厳密に2件（経験不足・保険未加入）だけになる", () => {
  const profile = baseProfile();
  profile.keieiGyomuKanri = {
    yearsAsResponsibleOfficer: 0,
    yearsAsQuasiResponsibleOfficer: 0,
    yearsAsAssistant: 0,
    isOfficerFor2Years: false,
    assistantSupportYears: { finance: 0, labor: 0, operations: 0 },
    hasSocialInsurance: false,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "keieiGyomuKanri");
  assert.deepEqual(check.reasons, [
    "経営業務管理責任者としての経験・準ずる地位・補佐業務・複合要件（ルートA〜D）のいずれも基準年数に達していません",
    "健康保険・厚生年金保険・雇用保険への適切な加入が確認できていません（本要件も必須）",
  ]);
  assert.deepEqual(check.warnings, []);
});

test("専任技術者: 国家資格保有のみの場合、理由・警告が厳密に単一ずつの文言になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.label, "営業所ごとの専任技術者の配置");
  assert.deepEqual(check.reasons, ["[本店] 該当する国家資格等の保有により要件を満たします"]);
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: 指定学科卒業（高卒）+実務経験5年の場合、理由が厳密にそのルートのものだけになる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "高卒",
      yearsOfPracticalExperience: 5,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.reasons, ["[本店] 指定学科卒業（高卒）+ 実務経験 5年で要件を満たします"]);
});

test("専任技術者: 指定学科卒業（大卒）+実務経験3年の場合、理由が厳密にそのルートのものだけになる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: true,
      educationLevel: "大卒",
      yearsOfPracticalExperience: 3,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.reasons, ["[本店] 指定学科卒業（大卒）+ 実務経験 3年で要件を満たします"]);
});

test("専任技術者: 実務経験10年ルートの場合、理由・警告が厳密に単一ずつの文言になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.reasons, ["[本店] 実務経験 10年（10年以上）で要件を満たします"]);
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: いずれの基準も満たさない場合、理由が厳密に単一の不合格文言だけになり、警告は出ない", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 9,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.reasons, [
    "[本店] 国家資格・指定学科卒業+実務経験・実務経験10年のいずれの基準も満たしていません",
  ]);
  assert.deepEqual(check.warnings, []);
});

test("専任技術者: 特定建設業で指導監督的実務経験が不足する場合、理由が厳密に2件（実務経験10年・指導監督的実務経験不足）になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 1,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.reasons, [
    "[本店] 実務経験 10年（10年以上）で要件を満たします",
    "[本店] 特定建設業は上記に加えて、4,500万円以上の工事における指導監督的実務経験2年以上（または該当する国家資格）が必要ですが、確認できていません",
  ]);
});

test("専任技術者: 特定建設業で指導監督的実務経験2年以上を満たす場合、理由が厳密に2件（実務経験10年・指導監督的実務経験充足）になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "特定",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 10,
      yearsOfSupervisoryExperience: 2,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.reasons, [
    "[本店] 実務経験 10年（10年以上）で要件を満たします",
    "[本店] 指導監督的実務経験 2年（2年以上）で特定建設業の追加要件も満たします",
  ]);
});

test("専任技術者: 複数営業所のうち不合格の営業所からは警告が出ない（flatMapで各営業所の警告だけが集約されることの確認）", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [
    {
      officeName: "本店",
      licenseType: "一般",
      hasNationalLicense: true,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
    {
      officeName: "支店",
      licenseType: "一般",
      hasNationalLicense: false,
      isDesignatedCourseGraduate: false,
      educationLevel: null,
      yearsOfPracticalExperience: 0,
      yearsOfGeneralExperience: 0,
      yearsOfSupervisoryExperience: 0,
    },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.deepEqual(check.warnings, ["本店: 資格者証・卒業証明書・実務経験証明書など裏付け書類の準備を忘れずに"]);
});

test("専任技術者: 営業所が1つも登録されていない場合、label・警告が厳密に早期returnの値になる", () => {
  const profile = baseProfile();
  profile.senninGijutsushaList = [];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "senninGijutsusha");
  assert.equal(check.label, "営業所ごとの専任技術者の配置");
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 一般建設業でルート1（自己資本）のみ該当する場合、label・理由・警告が厳密にルート1の文言だけになる", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 5_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.equal(check.label, "財産的基礎（金銭的信用）");
  assert.deepEqual(check.reasons, ["自己資本 5,000,000円 が500万円以上で要件を満たします"]);
  assert.deepEqual(check.warnings, []);
});

test("財産的基礎: 一般建設業でルート2（資金調達能力）のみ該当する場合、理由が厳密にルート2の文言だけになる", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 5_000_000,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.deepEqual(check.reasons, ["資金調達能力 5,000,000円 が500万円以上で要件を満たします"]);
});

test("財産的基礎: 一般建設業でルート3（継続営業実績）のみ該当する場合、理由が厳密にルート3の文言だけになる", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: true,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.deepEqual(check.reasons, ["直近5年間、許可を受けて継続して営業した実績があり要件を満たします"]);
});

test("財産的基礎: 一般建設業で3ルートいずれも満たさない場合、理由が厳密に単一の不合格文言だけになる", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "一般",
    netAssets: 0,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 0,
    deficitRatio: 0,
    currentRatio: 0,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.deepEqual(check.reasons, [
    "自己資本500万円以上・資金調達能力500万円以上・5年間の継続営業実績のいずれも確認できません",
  ]);
});

test("財産的基礎: 特定建設業が3条件すべて満たす場合、理由・警告が厳密に実額込みの文言になる（yen()整形の検証込み）", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 40_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 20_000_000,
    deficitRatio: 20,
    currentRatio: 75,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.deepEqual(check.reasons, [
    "欠損比率 20% が資本金の20%以下で条件クリア",
    "流動比率 75% が75%以上で条件クリア",
    "資本金 20,000,000円（2,000万円以上）・自己資本 40,000,000円（4,000万円以上）で条件クリア",
  ]);
  assert.deepEqual(check.warnings, [
    "特定建設業は上記3条件を「すべて」満たす必要があります（一般建設業のような選択制ではありません）",
  ]);
});

test("財産的基礎: 特定建設業で資本金のみ基準未満の場合、理由が厳密に資本金/自己資本の未達文言になる", () => {
  const profile = baseProfile();
  profile.zaisanKiso = {
    licenseType: "特定",
    netAssets: 100_000_000,
    fundingCapacity: 0,
    hasFiveYearsContinuousOperation: false,
    capitalAmount: 19_999_999,
    deficitRatio: 0,
    currentRatio: 100,
  };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "zaisanKiso");
  assert.deepEqual(check.reasons, [
    "欠損比率 0% が資本金の20%以下で条件クリア",
    "流動比率 100% が75%以上で条件クリア",
    "資本金または自己資本が基準（資本金2,000万円以上かつ自己資本4,000万円以上）に達していません",
  ]);
});

test("誠実性: 合格時の理由・警告が厳密に単一の文言だけになる（申告メモなし）", () => {
  const result = evaluateEligibility(baseProfile());
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.equal(check.label, "誠実性");
  assert.deepEqual(check.reasons, ["自己申告上、不正・不誠実な行為をするおそれがある事実は確認されていません"]);
  assert.deepEqual(check.warnings, [
    "誠実性は定量判定できない要件のため、本ツールの結果を鵜呑みにせず、行政書士本人が過去の営業実態・関連資格の処分歴等を個別に確認してください",
  ]);
});

test("誠実性: 不合格時の理由が厳密に単一の文言だけになる（申告メモなし）", () => {
  const profile = baseProfile();
  profile.seijitsusei = { hasNoDishonestActRisk: false };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "seijitsusei");
  assert.deepEqual(check.reasons, ["自己申告で、不正・不誠実な行為のおそれに関する懸念が申告されています"]);
});

test("欠格要件: 役員が5年以内の許可取消し経験に該当する場合は不合格（建設業法第8条第12号）", () => {
  const profile = baseProfile();
  profile.officers = [{ name: "佐藤 一郎", title: "取締役", kekkaku: { hadLicenseRevokedWithin5Years: true } }];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some(
      (r) => r.includes("役員（佐藤 一郎）") && r.includes("5年以内に建設業許可を取り消された経験があります") && r.includes("第十二号")
    )
  );
});

test("欠格要件: 役員が許可取消しの聴聞通知後の駆け込み廃業に該当する場合は不合格（建設業法第8条第12号）", () => {
  const profile = baseProfile();
  profile.officers = [
    { name: "佐藤 一郎", title: "取締役", kekkaku: { hasWithdrawnLicenseDuringRevocationHearingWithin5Years: true } },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some(
      (r) => r.includes("役員（佐藤 一郎）") && r.includes("廃業届出をしてから5年を経過していません") && r.includes("第十二号")
    )
  );
});

test("欠格要件: 役員が許可取消しの聴聞通知前60日以内の役員等に該当する場合は不合格（建設業法第8条第12号）", () => {
  const profile = baseProfile();
  profile.officers = [{ name: "佐藤 一郎", title: "取締役", kekkaku: { hasRevocationNoticeWithin60DaysAsOfficer: true } }];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some(
      (r) => r.includes("役員（佐藤 一郎）") && r.includes("聴聞通知前60日以内に当該法人の役員等でした") && r.includes("第十二号")
    )
  );
});

test("欠格要件: 役員が営業禁止処分の禁止期間中に該当する場合は不合格（建設業法第8条第12号）", () => {
  const profile = baseProfile();
  profile.officers = [{ name: "佐藤 一郎", title: "取締役", kekkaku: { hasBusinessProhibitionOrderInEffect: true } }];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(
    check.reasons.some((r) => r.includes("役員（佐藤 一郎）") && r.includes("営業禁止処分の禁止期間中です") && r.includes("第十二号"))
  );
});

test("欠格要件: 未成年者の法定代理人の氏名が未入力でも、欠格事由があれば「法定代理人」とだけ表示して不合格にする", () => {
  const profile = baseProfile();
  profile.kekkaku.isMinor = true;
  profile.kekkaku.legalRepresentativeKekkaku = { isUndischargedBankrupt: true };
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes("法定代理人が破産者で復権を得ていません（第十一号）")));
});

test("欠格要件: 全項目が該当なしの標準ケースでは、label・理由・警告が厳密に単一の合格文言だけになる", () => {
  const result = evaluateEligibility(baseProfile());
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.equal(check.label, "欠格要件に該当しないこと");
  assert.deepEqual(check.reasons, [
    "欠格要件（建設業法第8条各号: 破産・許可取消歴・駆け込み廃業・営業停止/禁止処分中・刑罰・" +
      "暴力団関係・心身の故障・虚偽記載、および役員等・政令使用人・法定代理人の欠格〈入力がある範囲〉）" +
      "のいずれにも該当しません",
  ]);
  assert.deepEqual(check.warnings, []);
});

test("欠格要件: 役員が複数いて一部だけ欠格事由を入力済みの場合、未入力警告は出さない（everyがsomeに壊れていないことの確認）", () => {
  const profile = baseProfile();
  profile.officers = [
    { name: "佐藤 一郎", title: "取締役", kekkaku: { isUndischargedBankrupt: false } },
    { name: "鈴木 花子", title: "監査役" },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.ok(!check.warnings.some((w) => w.includes("役員の欠格事由（第十二号）が未入力です")));
});

test("欠格要件: 政令で定める使用人が複数いて一部だけ欠格事由を入力済みの場合、未入力警告は出さない（everyがsomeに壊れていないことの確認）", () => {
  const profile = baseProfile();
  profile.regulatoryEmployees = [
    { name: "田中 次郎", kekkaku: { isUndischargedBankrupt: false } },
    { name: "高橋 三郎" },
  ];
  const result = evaluateEligibility(profile);
  const check = result.checks.find((c) => c.key === "kekkaku");
  assert.ok(!check.warnings.some((w) => w.includes("政令で定める使用人の欠格事由")));
});

/**
 * 【ミューテーションテストで判明した等価ミュータント（2026年10月・#79優先度A）】
 * - `keieiGyomuKanri.js`の`input.assistantSupportYears || { finance: 0, labor: 0, operations: 0 }`を
 *   `|| {}`に置き換えるミュータント: `assistantSupportYears`が未入力の場合、フォールバック後の
 *   `support.finance`等は、デフォルト値が`0`でも`{}`由来の`undefined`でも、直後の`>= 5`比較の結果は
 *   いずれも`false`になり、ルートDの判定は変化しない。等価ミュータント。
 * - `kekkaku.js`の`officers ?? []`・`regulatoryEmployees ?? []`を`?? ["Stryker was here"]`に
 *   置き換えるミュータント: 未入力時のフォールバックが配列の代わりに文字列1件になっても、
 *   `for...of`でその要素（文字列）を`buildPersonFlags(officer.kekkaku, ...)`に渡すと
 *   `officer.kekkaku`は`undefined`になり、`buildPersonFlags`は`if (!person) return [];`で
 *   即座に空配列を返すため、挙動は変わらない（kobutsuの`eigyosho.js`の同型ミュータントと同じ理由）。
 */
