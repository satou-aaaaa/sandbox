/**
 * Webフォーム（formPage.js）のブラウザ側JavaScript（buildProfile等）の自動テスト。
 *
 * これまでこのロジックはブラウザ自動化による手動確認でしか検証されておらず、
 * 過去に「工事経歴がbuildProfile()で収集されていない」という実バグが
 * コードレビューでしか見つからなかった経緯がある（PR #25）。
 * jsdomで実際に<script>を実行することで、CLIENT_SCRIPT文字列内のロジックを
 * 再実装せずそのまま自動テストの対象にする。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { renderFormPage } from "../src/web/formPage.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";
import { checkKekkaku } from "../src/licenses/construction/eligibility/rules/kekkaku.js";

/**
 * PersonKekkakuInput（役員・令3条使用人・法定代理人1名分の欠格事由）の
 * 8項目。formPage.js の CLIENT_SCRIPT 内 PERSON_KEKKAKU_FIELDS と同じ一覧
 * （src/licenses/construction/eligibility/types.js のPersonKekkakuInput参照）。
 */
const PERSON_KEKKAKU_FIELDS = [
  "isUndischargedBankrupt",
  "hadLicenseRevokedWithin5Years",
  "hasWithdrawnLicenseDuringRevocationHearingWithin5Years",
  "hasRevocationNoticeWithin60DaysAsOfficer",
  "hasBusinessProhibitionOrderInEffect",
  "hasCriminalRecordWithin5Years",
  "isBoryokudanMemberOrWithin5Years",
  "hasMentalImpairmentAffectingDuties",
];

/**
 * renderFormPage() のHTMLを実際に<script>込みで実行し、window（グローバル関数群）を返す。
 * @param {Parameters<typeof renderFormPage>[0]} [options]
 */
function loadFormWindow(options) {
  const html = renderFormPage(options);
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
  return dom.window;
}

/**
 * jsdomのwindow（別レルム）で作られたオブジェクトを、このプロセスの通常の
 * Object/Array（同一レルム）に変換する。assert.deepEqual はレルムをまたぐと
 * 中身が同じでも「reference-equalではない」として失敗するため必要
 * （値はすべてJSON化可能なプリミティブのみのため、JSON往復で問題ない）。
 * @param {unknown} value
 */
function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("buildProfile: 初期状態（新規入力・空フォーム）では役員1件・営業所1件の空行、工事経歴0件を返す", () => {
  const { document, buildProfile } = loadFormWindow();
  document.getElementById("applicantName").value = "テスト建設株式会社";
  const profile = buildProfile();
  assert.equal(profile.applicantName, "テスト建設株式会社");
  assert.equal(profile.officers.length, 1);
  assert.equal(profile.senninGijutsushaList.length, 1);
  assert.equal(profile.constructionHistory.length, 0);
  assert.equal(profile.completedConstructionCost.materialCost, 0);
  assert.equal(profile.completedConstructionCost.laborCost, 0);
  assert.equal(profile.completedConstructionCost.subcontractCost, 0);
  assert.equal(profile.completedConstructionCost.expenses, 0);
  assert.equal(profile.completedConstructionCost.subcontractedLaborCost, undefined);
  assert.equal(profile.completedConstructionCost.personnelExpenses, undefined);
});

test("buildProfile: 工事経歴を追加して入力すると constructionHistory に反映される（回帰テスト: PR #25で修正されたバグの再発防止）", () => {
  const { document, buildProfile } = loadFormWindow();
  document.getElementById("addConstructionHistoryBtn").click();
  const row = document.querySelector("#constructionHistoryContainer .construction-history-row");
  row.querySelector(".ch-constructionType").value = "建築工事業";
  row.querySelector(".ch-isSubcontract").value = "true";
  row.querySelector(".ch-orderer").value = "A社";
  row.querySelector(".ch-projectName").value = "工事A";
  row.querySelector(".ch-contractAmount").value = "1000000";
  row.querySelector(".ch-completionDateIso").value = "2025-01";

  const profile = buildProfile();
  assert.equal(profile.constructionHistory.length, 1);
  assert.deepEqual(toPlain(profile.constructionHistory[0]), {
    constructionType: "建築工事業",
    isSubcontract: true,
    orderer: "A社",
    projectName: "工事A",
    contractAmount: 1_000_000,
    completionDateIso: "2025-01",
  });
});

test("buildProfile: 工事経歴の任意項目（着手年月・配置技術者）は未入力なら結果に含まれない", () => {
  const { document, buildProfile } = loadFormWindow();
  document.getElementById("addConstructionHistoryBtn").click();
  const row = document.querySelector("#constructionHistoryContainer .construction-history-row");
  row.querySelector(".ch-constructionType").value = "建築工事業";
  row.querySelector(".ch-orderer").value = "A社";
  row.querySelector(".ch-projectName").value = "工事A";
  row.querySelector(".ch-completionDateIso").value = "2025-01";

  const record = buildProfile().constructionHistory[0];
  assert.ok(!("startDateIso" in record));
  assert.ok(!("assignedEngineerName" in record));
  assert.ok(!("engineerRole" in record));
});

test("buildProfile: 完成工事原価報告書の任意内訳2項目は未入力ならundefinedになり、入力すれば数値になる", () => {
  const { document, buildProfile } = loadFormWindow();
  let profile = buildProfile();
  assert.equal(profile.completedConstructionCost.subcontractedLaborCost, undefined);
  assert.equal(profile.completedConstructionCost.personnelExpenses, undefined);

  document.getElementById("ccSubcontractedLaborCost").value = "2000000";
  document.getElementById("ccPersonnelExpenses").value = "0"; // 「0円」という明示入力
  profile = buildProfile();
  assert.equal(profile.completedConstructionCost.subcontractedLaborCost, 2_000_000);
  assert.equal(profile.completedConstructionCost.personnelExpenses, 0);
});

test("buildProfile: 下書きから復元したプロフィールをそのまま再送信すると元の内容が再現される（往復確認）", () => {
  const sample = buildSampleApplicantProfile();
  const { buildProfile } = loadFormWindow({ profile: sample });
  const rebuilt = toPlain(buildProfile());

  assert.equal(rebuilt.applicantName, sample.applicantName);
  assert.equal(rebuilt.applicantType, sample.applicantType);
  assert.equal(rebuilt.representativeName, sample.representativeName);
  assert.deepEqual(rebuilt.constructionTypes, sample.constructionTypes);

  assert.equal(rebuilt.officers.length, sample.officers.length);
  sample.officers.forEach((officer, i) => {
    assert.equal(rebuilt.officers[i].name, officer.name);
    assert.equal(rebuilt.officers[i].title, officer.title);
    assert.equal(rebuilt.officers[i].birthDate, officer.birthDate);
    assert.deepEqual(rebuilt.officers[i].kekkaku, officer.kekkaku);
  });

  assert.equal(rebuilt.regulatoryEmployees.length, sample.regulatoryEmployees.length);
  sample.regulatoryEmployees.forEach((employee, i) => {
    assert.equal(rebuilt.regulatoryEmployees[i].name, employee.name);
    assert.equal(rebuilt.regulatoryEmployees[i].title, employee.title);
    assert.deepEqual(rebuilt.regulatoryEmployees[i].kekkaku, employee.kekkaku);
  });

  assert.equal(rebuilt.senninGijutsushaList.length, sample.senninGijutsushaList.length);
  assert.equal(rebuilt.senninGijutsushaList[0].officeName, sample.senninGijutsushaList[0].officeName);
  assert.equal(rebuilt.senninGijutsushaList[0].personName, sample.senninGijutsushaList[0].personName);
  assert.equal(rebuilt.senninGijutsushaList[0].hasNationalLicense, sample.senninGijutsushaList[0].hasNationalLicense);

  assert.equal(rebuilt.constructionHistory.length, sample.constructionHistory.length);
  assert.deepEqual(rebuilt.constructionHistory[0], sample.constructionHistory[0]);
  assert.deepEqual(rebuilt.constructionHistory[1], sample.constructionHistory[1]);

  assert.deepEqual(rebuilt.completedConstructionCost, sample.completedConstructionCost);
  assert.deepEqual(rebuilt.keieiGyomuKanri, sample.keieiGyomuKanri);
  assert.deepEqual(rebuilt.zaisanKiso, sample.zaisanKiso);
  // sample.kekkaku は isMinor/legalRepresentativeKekkaku を含まない（未成年者ではない
  // 申請者のサンプルのため）。buildProfile()は常にisMinorを明示的なbooleanとして
  // 送るため、個別キーで比較する（深い等価比較だとキー集合の差で失敗する）。
  Object.keys(sample.kekkaku).forEach((key) => {
    assert.equal(rebuilt.kekkaku[key], sample.kekkaku[key], `kekkaku.${key}`);
  });
  assert.equal(rebuilt.kekkaku.isMinor, false);
  assert.equal(rebuilt.kekkaku.legalRepresentativeKekkaku, undefined);
  assert.equal(rebuilt.seijitsusei.hasNoDishonestActRisk, sample.seijitsusei.hasNoDishonestActRisk);
});

test("missingFieldsPanel: 必須項目が未入力の状態では未入力項目の一覧が表示される", () => {
  const { document } = loadFormWindow();
  const panel = document.getElementById("missingFieldsPanel");
  assert.equal(panel.hidden, false);
  assert.match(panel.innerHTML, /代表者氏名/);
  assert.match(panel.innerHTML, /申請年月日/);
});

test("missingFieldsPanel: 必須項目をすべて入力するとパネルが非表示になる", () => {
  const { document } = loadFormWindow();
  document.getElementById("representativeName").value = "山田 太郎";
  document.getElementById("address").value = "東京都千代田区";
  document.getElementById("prefecture").value = "東京都";
  document.getElementById("applicationDate").value = "2026-09-11";
  document.getElementById("constructionTypes").value = "建築工事業";
  document.getElementById("responsibleName").value = "山田 太郎";
  document.querySelector("#officersContainer .officer-name").value = "山田 太郎";
  document.querySelector("#officersContainer .officer-title").value = "代表取締役";
  document.querySelector("#officersContainer .officer-kekkaku-confirmed").checked = true;
  document.querySelector("#officesContainer .office-officeName").value = "本店";
  document.querySelector("#officesContainer .office-personName").value = "佐藤 一郎";

  document.getElementById("applicantForm").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));

  const panel = document.getElementById("missingFieldsPanel");
  assert.equal(panel.hidden, true);
});

test("missingFieldsPanel: 工事名等に<を含む値を入れてもHTMLタグとして注入されない（XSS対策）", () => {
  const { document } = loadFormWindow();
  document.getElementById("addConstructionHistoryBtn").click();
  const row = document.querySelector("#constructionHistoryContainer .construction-history-row");
  row.querySelector(".ch-projectName").value = "<img src=x onerror=alert(1)>";

  document.getElementById("applicantForm").dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));

  const panel = document.getElementById("missingFieldsPanel");
  assert.ok(!panel.querySelector("img"));
  assert.match(panel.innerHTML, /&lt;img/);
});

/**
 * Issue #227 の受け入れ条件6（重要）: 役員・令3条使用人・法定代理人の
 * 欠格事由は、「欠格事由の確認」チェックボックス（<prefix>-confirmed）を
 * 明示的にチェックしない限り、個々の項目チェックボックスの状態（すべて
 * 未チェック=false）に関わらず `kekkaku` を undefined として送る。
 * これにより、未入力の人物を「欠格なし（全項目false）」として自動的に
 * 合格扱いにしてしまうことを防ぐ（CLAUDE.mdの「判定の合否を曖昧に
 * フォールバックさせない」方針。rules/kekkaku.js側の
 * `officers?.length && officers.every((o) => !o.kekkaku)` による
 * warning判定が、buildProfile()側の挙動次第で機能しなくなる回帰を防止する）。
 */
test("buildProfile: 役員の「欠格事由の確認」をチェックしないまま送信すると、officers[].kekkakuはundefinedになり自動的に合格扱いにならない", () => {
  const { document, buildProfile } = loadFormWindow();
  document.querySelector("#officersContainer .officer-name").value = "山田 太郎";
  document.querySelector("#officersContainer .officer-title").value = "代表取締役";
  // .officer-kekkaku-confirmed は意図的にチェックしない（未確認の状態を再現）。

  const profile = buildProfile();
  assert.equal(profile.officers[0].kekkaku, undefined);

  const check = checkKekkaku(profile.kekkaku, profile.officers, profile.regulatoryEmployees, profile.applicantType);
  assert.equal(check.passed, true); // 不合格に誤ってフォールバックするのでもない
  assert.ok(
    check.warnings.some((w) => w.includes("役員の欠格事由") && w.includes("未入力")),
    `warningsに未確認の旨が含まれない: ${JSON.stringify(check.warnings)}`
  );
});

test("buildProfile: 令3条使用人の「欠格事由の確認」をチェックしないまま送信すると、regulatoryEmployees[].kekkakuはundefinedになる", () => {
  const { document, buildProfile } = loadFormWindow();
  document.getElementById("addRegulatoryEmployeeBtn").click();
  const row = document.querySelector("#regulatoryEmployeesContainer .regulatory-employee-row");
  row.querySelector(".employee-name").value = "田中 次郎";
  // .employee-kekkaku-confirmed は意図的にチェックしない。

  const profile = buildProfile();
  assert.equal(profile.regulatoryEmployees[0].kekkaku, undefined);

  const check = checkKekkaku(profile.kekkaku, profile.officers, profile.regulatoryEmployees, profile.applicantType);
  assert.ok(
    check.warnings.some((w) => w.includes("政令で定める使用人の欠格事由") && w.includes("未入力")),
    `warningsに未確認の旨が含まれない: ${JSON.stringify(check.warnings)}`
  );
});

test("buildProfile: isMinorをチェックしても法定代理人の「欠格事由の確認」をチェックしなければlegalRepresentativeKekkakuはundefinedのままになる", () => {
  const { document, buildProfile } = loadFormWindow();
  document.getElementById("isMinor").checked = true;
  document.getElementById("legalRepresentativeName").value = "山田 一郎";
  // .legalRep-kekkaku-confirmed は意図的にチェックしない。

  const profile = buildProfile();
  assert.equal(profile.kekkaku.isMinor, true);
  assert.equal(profile.kekkaku.legalRepresentativeKekkaku, undefined);

  const check = checkKekkaku(profile.kekkaku, profile.officers, profile.regulatoryEmployees, profile.applicantType);
  assert.ok(
    check.warnings.some((w) => w.includes("法定代理人の欠格事由") && w.includes("未入力")),
    `warningsに未確認の旨が含まれない: ${JSON.stringify(check.warnings)}`
  );
});

/**
 * Issue #227 の受け入れ条件6: 人物ごとの欠格事由8項目を単独でtrueにした
 * 場合に、その項目だけがtrueとして反映され、他の項目はfalse（明示的な
 * 「該当しない」回答）になることを確認する。
 * @param {string} prefix チェックボックスのクラス名接頭辞
 * @param {(doc: Document) => Element} getScope 対象行/要素を取得する関数
 * @param {(profile: object) => object | undefined} getKekkaku buildProfile()の結果からkekkakuを取り出す関数
 */
function assertEachPersonKekkakuFieldRoundTrips(prefix, getScope, getKekkaku) {
  PERSON_KEKKAKU_FIELDS.forEach((field) => {
    const { document, buildProfile } = loadFormWindow();
    const scope = getScope(document);
    scope.querySelector("." + prefix + "-confirmed").checked = true;
    scope.querySelector("." + prefix + "-" + field).checked = true;

    const kekkaku = getKekkaku(buildProfile());
    PERSON_KEKKAKU_FIELDS.forEach((other) => {
      assert.equal(kekkaku[other], other === field, `${field}のみチェック時の${other}の値`);
    });
  });
}

test("buildProfile: 役員の欠格事由8項目をそれぞれ単独でチェックすると、その項目だけがtrueになる", () => {
  assertEachPersonKekkakuFieldRoundTrips(
    "officer-kekkaku",
    (document) => document.querySelector("#officersContainer .officer-row"),
    (profile) => profile.officers[0].kekkaku
  );
});

test("buildProfile: 令3条使用人の欠格事由8項目をそれぞれ単独でチェックすると、その項目だけがtrueになる", () => {
  assertEachPersonKekkakuFieldRoundTrips(
    "employee-kekkaku",
    (document) => {
      document.getElementById("addRegulatoryEmployeeBtn").click();
      return document.querySelector("#regulatoryEmployeesContainer .regulatory-employee-row");
    },
    (profile) => profile.regulatoryEmployees[0].kekkaku
  );
});

test("buildProfile: 法定代理人の欠格事由8項目をそれぞれ単独でチェックすると、その項目だけがtrueになる", () => {
  assertEachPersonKekkakuFieldRoundTrips(
    "legalRep-kekkaku",
    (document) => document,
    (profile) => profile.kekkaku.legalRepresentativeKekkaku
  );
});

test("buildProfile: 下書きから役員・令3条使用人・法定代理人の欠格事由を復元すると元の内容が再現される（往復確認）", () => {
  const sample = buildSampleApplicantProfile();
  sample.kekkaku.isMinor = true;
  sample.kekkaku.legalRepresentativeName = "山田 一郎";
  sample.kekkaku.legalRepresentativeKekkaku = { isUndischargedBankrupt: true, hasCriminalRecordWithin5Years: true };

  const { buildProfile } = loadFormWindow({ profile: sample });
  const rebuilt = toPlain(buildProfile());

  assert.deepEqual(rebuilt.officers[0].kekkaku, sample.officers[0].kekkaku);
  assert.deepEqual(rebuilt.officers[1].kekkaku, sample.officers[1].kekkaku);
  assert.deepEqual(rebuilt.regulatoryEmployees[0].kekkaku, sample.regulatoryEmployees[0].kekkaku);
  assert.equal(rebuilt.kekkaku.isMinor, true);
  assert.equal(rebuilt.kekkaku.legalRepresentativeName, sample.kekkaku.legalRepresentativeName);
  assert.deepEqual(rebuilt.kekkaku.legalRepresentativeKekkaku, {
    isUndischargedBankrupt: true,
    hadLicenseRevokedWithin5Years: false,
    hasWithdrawnLicenseDuringRevocationHearingWithin5Years: false,
    hasRevocationNoticeWithin60DaysAsOfficer: false,
    hasBusinessProhibitionOrderInEffect: false,
    hasCriminalRecordWithin5Years: true,
    isBoryokudanMemberOrWithin5Years: false,
    hasMentalImpairmentAffectingDuties: false,
  });
});
