/**
 * M3: インテイク用の簡易Webフォーム（画面）。
 *
 * ブラウザで ApplicantProfile を入力し、要件判定・書類生成をワンストップで
 * 実行できるようにする。CLI/スクリプトでJSオブジェクトを直接組み立てる必要を
 * なくすことが目的（FR-4.2 の次フェーズ対応）。
 *
 * 【設計方針】
 * - フレームワーク・ビルドステップは導入しない（NFR-1）。素のHTML/CSS/JSのみ。
 * - フォームの値は送信直前にブラウザ側のJavaScriptでApplicantProfile型と同じ
 *   構造のJSONに組み立て、hiddenフィールド経由で通常のPOSTとして送信する
 *   （fetch/XHRやAPIエンドポイントの多重定義を避け、サーバー側の受け口を単純化するため）。
 * - 通信は常にローカルホスト内で完結する（NFR-4: 外部送信をしない）。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * インテイクフォームのHTMLページを返す。
 * @param {{ error?: string }} [options]
 * @returns {string}
 */
export function renderFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>kensetsu-kyoka-toolkit — 申請者情報インテイク</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>建設業許可 申請者情報インテイク</h1>
  <p class="notice">
    ※ この画面の判定結果は「申請前の一次スクリーニング」に過ぎません。
    最終的な適格性の判断・書類の内容確認・提出は必ず登録行政書士本人が行ってください。
    実在の顧客情報を入力する場合、このツールはローカルでのみ動作し外部へは送信しません。
  </p>
  <p><a href="/reminders">→ 更新リマインド・ダイジェストを見る</a></p>
</header>
${errorBlock}
<form id="applicantForm" method="POST" action="/submit">
  <input type="hidden" name="profileJson" id="profileJson">

  <section>
    <h2>1. 基本情報</h2>
    <label>申請者名（商号又は名称） <input type="text" id="applicantName" required></label>
    <label>代表者氏名 <input type="text" id="representativeName"></label>
    <label>主たる営業所の所在地 <input type="text" id="address"></label>
    <label>許可行政庁（都道府県） <input type="text" id="prefecture"></label>
    <label>申請年月日 <input type="date" id="applicationDate"></label>
    <label>許可を受けようとする建設業の種類（読点「、」区切り） <input type="text" id="constructionTypes" placeholder="例: 建築工事業、電気工事業"></label>
  </section>

  <section>
    <h2>2. 役員等の一覧（様式第六号用）</h2>
    <div id="officersContainer"></div>
    <button type="button" id="addOfficerBtn">＋ 役員を追加</button>
  </section>

  <section>
    <h2>3. 経営業務管理体制</h2>
    <label>経営業務管理責任者としての経験年数 <input type="number" id="yearsAsResponsibleOfficer" value="0" min="0"></label>
    <label>準ずる地位での経験年数 <input type="number" id="yearsAsQuasiResponsibleOfficer" value="0" min="0"></label>
    <label>補佐する業務での経験年数 <input type="number" id="yearsAsAssistant" value="0" min="0"></label>
    <label><input type="checkbox" id="isOfficerFor2Years"> 直近2年以上、常勤役員等の地位にある（ルートD用）</label>
    <fieldset>
      <legend>財務・労務・運営の補佐者配置年数（ルートD用）</legend>
      <label>財務 <input type="number" id="assistantSupportYearsFinance" value="0" min="0"></label>
      <label>労務 <input type="number" id="assistantSupportYearsLabor" value="0" min="0"></label>
      <label>運営 <input type="number" id="assistantSupportYearsOperations" value="0" min="0"></label>
    </fieldset>
    <label><input type="checkbox" id="hasSocialInsurance"> 健康保険・厚生年金保険・雇用保険に適切に加入している</label>
    <label>証明を受ける者の氏名（様式第七号用） <input type="text" id="responsibleName"></label>
    <label>地位又は役名（様式第七号用） <input type="text" id="responsibleTitle"></label>
  </section>

  <section>
    <h2>4. 財産的基礎</h2>
    <label>許可区分（申請全体）
      <select id="zaisanLicenseType">
        <option value="一般">一般建設業</option>
        <option value="特定">特定建設業</option>
      </select>
    </label>
    <label>自己資本額（円） <input type="number" id="netAssets" value="0" min="0"></label>
    <label>資金調達能力（円） <input type="number" id="fundingCapacity" value="0" min="0"></label>
    <label><input type="checkbox" id="hasFiveYearsContinuousOperation"> 直近5年間、継続して営業した実績がある</label>
    <label>資本金の額（円、特定建設業用） <input type="number" id="capitalAmount" value="0" min="0"></label>
    <label>欠損比率（%、特定建設業用） <input type="number" id="deficitRatio" value="0"></label>
    <label>流動比率（%、特定建設業用） <input type="number" id="currentRatio" value="0"></label>
  </section>

  <section>
    <h2>5. 専任技術者（営業所ごと・様式第八号用）</h2>
    <div id="officesContainer"></div>
    <button type="button" id="addOfficeBtn">＋ 営業所を追加</button>
  </section>

  <section>
    <h2>6. 欠格要件（該当するものにチェック）</h2>
    <label><input type="checkbox" id="isUndischargedBankrupt"> 破産者で復権を得ていない</label>
    <label><input type="checkbox" id="hadLicenseRevokedWithin5Years"> 5年以内に建設業許可を取り消された経験がある</label>
    <label><input type="checkbox" id="hasCriminalRecordWithin5Years"> 禁錮以上の刑、または関連法令違反による罰金刑から5年を経過していない</label>
    <label><input type="checkbox" id="isBoryokudanMemberOrWithin5Years"> 暴力団員である、または脱退から5年を経過していない</label>
    <label><input type="checkbox" id="hasMentalImpairmentAffectingDuties"> 心身の故障により建設業を適正に営むことができないと認められる</label>
    <label><input type="checkbox" id="hasFalseOrOmittedStatement"> 申請書・添付書類に虚偽の記載、または重要な事実の記載漏れがある</label>
  </section>

  <section>
    <h2>7. 誠実性</h2>
    <label><input type="checkbox" id="hasNoDishonestActRisk" checked> 請負契約に関して不正・不誠実な行為をするおそれが明らかでない</label>
    <label>申告メモ（任意） <textarea id="seijitsuseiNotes" rows="2"></textarea></label>
  </section>

  <button type="submit" class="primary">要件判定＋書類サマリーを生成する</button>
</form>

<template id="officerRowTemplate">
  <div class="row officer-row">
    <input type="text" class="officer-name" placeholder="氏名">
    <input type="text" class="officer-title" placeholder="役名（例: 代表取締役）">
    <input type="date" class="officer-birthDate">
    <button type="button" class="removeRowBtn">削除</button>
  </div>
</template>

<template id="officeRowTemplate">
  <fieldset class="row office-row">
    <legend>営業所</legend>
    <label>営業所名 <input type="text" class="office-officeName"></label>
    <label>専任技術者の氏名 <input type="text" class="office-personName"></label>
    <label>許可区分
      <select class="office-licenseType">
        <option value="一般">一般建設業</option>
        <option value="特定">特定建設業</option>
      </select>
    </label>
    <label><input type="checkbox" class="office-hasNationalLicense"> 該当する国家資格等を保有</label>
    <label><input type="checkbox" class="office-isDesignatedCourseGraduate"> 指定学科卒業</label>
    <label>学歴区分
      <select class="office-educationLevel">
        <option value="">未選択</option>
        <option value="高卒">高卒</option>
        <option value="大卒">大卒</option>
        <option value="その他">その他</option>
      </select>
    </label>
    <label>指定学科卒業者としての実務経験年数 <input type="number" class="office-yearsOfPracticalExperience" value="0" min="0"></label>
    <label>学歴不問の実務経験年数（10年要件用） <input type="number" class="office-yearsOfGeneralExperience" value="0" min="0"></label>
    <label>指導監督的実務経験年数（特定建設業用） <input type="number" class="office-yearsOfSupervisoryExperience" value="0" min="0"></label>
    <button type="button" class="removeRowBtn">削除</button>
  </fieldset>
</template>

<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

const STYLE = `
  :root { color-scheme: light; }
  body { font-family: "Yu Gothic", sans-serif; max-width: 820px; margin: 0 auto; padding: 16px 20px 60px; line-height: 1.6; }
  header h1 { margin-bottom: 4px; }
  .notice { background: #FFF4E5; border: 1px solid #E0A030; padding: 10px 14px; font-size: 0.9em; }
  .error { background: #FDECEC; border: 1px solid #C0392B; color: #7A1F1F; padding: 10px 14px; margin: 12px 0; }
  section { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  section h2 { margin-top: 0; font-size: 1.05em; }
  label { display: block; margin: 8px 0; }
  input[type=text], input[type=number], input[type=date], select, textarea { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
  .row { border: 1px dashed #bbb; border-radius: 4px; padding: 8px; margin: 8px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .row input, .row select { width: auto; }
  fieldset.row { display: block; }
  fieldset.row label { display: inline-block; margin-right: 12px; }
  button { cursor: pointer; }
  button.primary { font-size: 1.05em; padding: 10px 20px; margin-top: 8px; }
  .removeRowBtn { color: #a33; }
`;

const CLIENT_SCRIPT = `
function addRow(containerId, templateId) {
  const template = document.getElementById(templateId);
  const container = document.getElementById(containerId);
  const node = template.content.cloneNode(true);
  node.querySelector(".removeRowBtn").addEventListener("click", (e) => {
    e.target.closest(".row").remove();
  });
  container.appendChild(node);
}

document.getElementById("addOfficerBtn").addEventListener("click", () => addRow("officersContainer", "officerRowTemplate"));
document.getElementById("addOfficeBtn").addEventListener("click", () => addRow("officesContainer", "officeRowTemplate"));

// 初期状態で役員・営業所を1件ずつ用意しておく（0件からのスタートは分かりにくいため）。
addRow("officersContainer", "officerRowTemplate");
addRow("officesContainer", "officeRowTemplate");

function collectOfficers() {
  return Array.from(document.querySelectorAll("#officersContainer .officer-row")).map((row) => ({
    name: row.querySelector(".officer-name").value,
    title: row.querySelector(".officer-title").value,
    birthDate: row.querySelector(".officer-birthDate").value || undefined,
  }));
}

function collectOffices() {
  return Array.from(document.querySelectorAll("#officesContainer .office-row")).map((row) => ({
    officeName: row.querySelector(".office-officeName").value,
    personName: row.querySelector(".office-personName").value,
    licenseType: row.querySelector(".office-licenseType").value,
    hasNationalLicense: row.querySelector(".office-hasNationalLicense").checked,
    isDesignatedCourseGraduate: row.querySelector(".office-isDesignatedCourseGraduate").checked,
    educationLevel: row.querySelector(".office-educationLevel").value || null,
    yearsOfPracticalExperience: Number(row.querySelector(".office-yearsOfPracticalExperience").value) || 0,
    yearsOfGeneralExperience: Number(row.querySelector(".office-yearsOfGeneralExperience").value) || 0,
    yearsOfSupervisoryExperience: Number(row.querySelector(".office-yearsOfSupervisoryExperience").value) || 0,
  }));
}

function buildProfile() {
  const num = (id) => Number(document.getElementById(id).value) || 0;
  const str = (id) => document.getElementById(id).value || undefined;
  const checked = (id) => document.getElementById(id).checked;

  const constructionTypesRaw = document.getElementById("constructionTypes").value;
  const constructionTypes = constructionTypesRaw
    ? constructionTypesRaw.split(/[、,]/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    applicantName: document.getElementById("applicantName").value,
    representativeName: str("representativeName"),
    address: str("address"),
    prefecture: str("prefecture"),
    applicationDate: str("applicationDate"),
    constructionTypes,
    officers: collectOfficers(),
    keieiGyomuKanri: {
      yearsAsResponsibleOfficer: num("yearsAsResponsibleOfficer"),
      yearsAsQuasiResponsibleOfficer: num("yearsAsQuasiResponsibleOfficer"),
      yearsAsAssistant: num("yearsAsAssistant"),
      isOfficerFor2Years: checked("isOfficerFor2Years"),
      assistantSupportYears: {
        finance: num("assistantSupportYearsFinance"),
        labor: num("assistantSupportYearsLabor"),
        operations: num("assistantSupportYearsOperations"),
      },
      hasSocialInsurance: checked("hasSocialInsurance"),
      responsibleName: str("responsibleName"),
      responsibleTitle: str("responsibleTitle"),
    },
    senninGijutsushaList: collectOffices(),
    zaisanKiso: {
      licenseType: document.getElementById("zaisanLicenseType").value,
      netAssets: num("netAssets"),
      fundingCapacity: num("fundingCapacity"),
      hasFiveYearsContinuousOperation: checked("hasFiveYearsContinuousOperation"),
      capitalAmount: num("capitalAmount"),
      deficitRatio: num("deficitRatio"),
      currentRatio: num("currentRatio"),
    },
    kekkaku: {
      isUndischargedBankrupt: checked("isUndischargedBankrupt"),
      hadLicenseRevokedWithin5Years: checked("hadLicenseRevokedWithin5Years"),
      hasCriminalRecordWithin5Years: checked("hasCriminalRecordWithin5Years"),
      isBoryokudanMemberOrWithin5Years: checked("isBoryokudanMemberOrWithin5Years"),
      hasMentalImpairmentAffectingDuties: checked("hasMentalImpairmentAffectingDuties"),
      hasFalseOrOmittedStatement: checked("hasFalseOrOmittedStatement"),
    },
    seijitsusei: {
      hasNoDishonestActRisk: checked("hasNoDishonestActRisk"),
      notes: str("seijitsuseiNotes"),
    },
  };
}

document.getElementById("applicantForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
