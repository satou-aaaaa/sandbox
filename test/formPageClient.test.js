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
  assert.equal(rebuilt.representativeName, sample.representativeName);
  assert.deepEqual(rebuilt.constructionTypes, sample.constructionTypes);

  assert.equal(rebuilt.officers.length, sample.officers.length);
  sample.officers.forEach((officer, i) => {
    assert.equal(rebuilt.officers[i].name, officer.name);
    assert.equal(rebuilt.officers[i].title, officer.title);
    assert.equal(rebuilt.officers[i].birthDate, officer.birthDate);
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
  assert.deepEqual(rebuilt.kekkaku, sample.kekkaku);
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
