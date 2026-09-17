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
 * - 下書き保存（/drafts）は同じフォーム・同じprofileJsonの仕組みを再利用する。
 *   保存後にサーバーが払い出す draftId をhiddenフィールドで保持することで、
 *   2回目以降の保存は新規作成ではなく上書き更新になる。
 * - 未入力項目のチェックはブラウザ側JavaScriptで完結する「警告表示」であり、
 *   送信そのものをブロックしない（DESIGN.md 6章の「エラーで止めずwarningで
 *   継続する」方針を踏襲。あくまで入力者への気づきを与えるための補助表示）。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * インテイクフォームのHTMLページを返す。
 * @param {{ error?: string, profile?: import('../licenses/construction/eligibility/types.js').ApplicantProfile, draftId?: string, savedNotice?: boolean }} [options]
 * @returns {string}
 */
export function renderFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";
  const savedNoticeBlock = options.savedNotice ? `<div class="saved-notice">下書きを保存しました。</div>` : "";

  // ブラウザ側JSへ渡す初期値。JSON.stringify後に "</script" が出現すると
  // <script> タグを早期に閉じてしまう既知の問題があるため、"<" をエスケープする。
  const initialProfileJson = JSON.stringify(options.profile ?? null).replace(/</g, "\\u003c");

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
  <p>
    <a href="/reminders">→ 更新リマインド・ダイジェストを見る</a>
    ・ <a href="/drafts">→ 保存済みの下書き一覧を見る</a>
    ・ <a href="/kobutsu">→ 古物商許可のインテイクフォームへ</a>
  </p>
</header>
${errorBlock}
${savedNoticeBlock}
<main>
<form id="applicantForm" method="POST" action="/submit">
  <input type="hidden" name="profileJson" id="profileJson">
  <input type="hidden" name="draftId" id="draftId" value="${escapeHtml(options.draftId ?? "")}">

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
    <h2>6. 工事経歴（様式第二号用・任意）</h2>
    <div id="constructionHistoryContainer"></div>
    <button type="button" id="addConstructionHistoryBtn">＋ 工事を追加</button>
  </section>

  <section>
    <h2>7. 完成工事原価報告書（様式第十六号の一部・任意）</h2>
    <p class="notice">材料費・労務費・外注費・経費の4区分・6項目のみです（勘定科目の追加は認められていません）。</p>
    <label>材料費（円） <input type="number" id="ccMaterialCost" value="0" min="0"></label>
    <label>労務費（円） <input type="number" id="ccLaborCost" value="0" min="0"></label>
    <label>（うち）労務外注費（円・任意） <input type="number" id="ccSubcontractedLaborCost" min="0"></label>
    <label>外注費（円） <input type="number" id="ccSubcontractCost" value="0" min="0"></label>
    <label>経費（円） <input type="number" id="ccExpenses" value="0" min="0"></label>
    <label>（うち）人件費（円・任意） <input type="number" id="ccPersonnelExpenses" min="0"></label>
  </section>

  <section>
    <h2>8. 欠格要件（該当するものにチェック）</h2>
    <label><input type="checkbox" id="isUndischargedBankrupt"> 破産者で復権を得ていない</label>
    <label><input type="checkbox" id="hadLicenseRevokedWithin5Years"> 5年以内に建設業許可を取り消された経験がある</label>
    <label><input type="checkbox" id="hasWithdrawnLicenseDuringRevocationHearingWithin5Years"> 許可取消しの聴聞通知後、取消しを免れるため廃業届出をしてから5年を経過していない</label>
    <label><input type="checkbox" id="hasBusinessSuspensionOrderInEffect"> 営業停止命令の停止期間が経過していない</label>
    <label><input type="checkbox" id="hasBusinessProhibitionOrderInEffect"> 営業禁止処分の禁止期間が経過していない</label>
    <label><input type="checkbox" id="hasCriminalRecordWithin5Years"> 拘禁刑以上の刑、または関連法令違反による罰金刑から5年を経過していない</label>
    <label><input type="checkbox" id="isBoryokudanMemberOrWithin5Years"> 暴力団員である、または脱退から5年を経過していない</label>
    <label><input type="checkbox" id="hasMentalImpairmentAffectingDuties"> 心身の故障により建設業を適正に営むことができないと認められる</label>
    <label><input type="checkbox" id="isControlledByBoryokudanMember"> 暴力団員等がその事業活動を支配する者である</label>
    <label><input type="checkbox" id="hasFalseOrOmittedStatement"> 申請書・添付書類に虚偽の記載、または重要な事実の記載漏れがある</label>
  </section>

  <section>
    <h2>9. 誠実性</h2>
    <label><input type="checkbox" id="hasNoDishonestActRisk" checked> 請負契約に関して不正・不誠実な行為をするおそれが明らかでない</label>
    <label>申告メモ（任意） <textarea id="seijitsuseiNotes" rows="2"></textarea></label>
  </section>

  <div id="missingFieldsPanel" class="missing-panel" hidden></div>

  <div class="actions">
    <button type="submit" class="primary">要件判定＋書類サマリーを生成する</button>
    <button type="submit" formaction="/drafts" formnovalidate class="secondary">下書きとして保存</button>
  </div>
</form>
</main>

<template id="officerRowTemplate">
  <div class="row officer-row">
    <input type="text" class="officer-name" placeholder="氏名" aria-label="役員の氏名">
    <input type="text" class="officer-title" placeholder="役名（例: 代表取締役）" aria-label="役員の役名">
    <input type="date" class="officer-birthDate" aria-label="役員の生年月日">
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

<template id="constructionHistoryRowTemplate">
  <fieldset class="row construction-history-row">
    <legend>工事</legend>
    <label>建設工事の種類 <input type="text" class="ch-constructionType" placeholder="例: 建築工事業"></label>
    <label>元請/下請
      <select class="ch-isSubcontract">
        <option value="false">元請</option>
        <option value="true">下請</option>
      </select>
    </label>
    <label>注文者 <input type="text" class="ch-orderer"></label>
    <label>工事名 <input type="text" class="ch-projectName"></label>
    <label>請負代金の額（円） <input type="number" class="ch-contractAmount" value="0" min="0"></label>
    <label>工期（着手年月・任意） <input type="month" class="ch-startDateIso"></label>
    <label>工期（完成年月） <input type="month" class="ch-completionDateIso"></label>
    <label>配置技術者の氏名（任意） <input type="text" class="ch-assignedEngineerName"></label>
    <label>配置技術者の別（任意）
      <select class="ch-engineerRole">
        <option value="">未選択</option>
        <option value="主任技術者">主任技術者</option>
        <option value="監理技術者">監理技術者</option>
      </select>
    </label>
    <button type="button" class="removeRowBtn">削除</button>
  </fieldset>
</template>

<script>
  const INITIAL_PROFILE = ${initialProfileJson};
  ${CLIENT_SCRIPT}
</script>
</body>
</html>`;
}

const STYLE = `
  :root { color-scheme: light; }
  body { font-family: "Yu Gothic", sans-serif; max-width: 820px; margin: 0 auto; padding: 16px 20px 60px; line-height: 1.6; }
  header h1 { margin-bottom: 4px; }
  .notice { background: #FFF4E5; border: 1px solid #E0A030; padding: 10px 14px; font-size: 0.9em; }
  .error { background: #FDECEC; border: 1px solid #C0392B; color: #7A1F1F; padding: 10px 14px; margin: 12px 0; }
  .saved-notice { background: #E7F6EC; border: 1px solid #1E7A34; color: #1E7A34; padding: 10px 14px; margin: 12px 0; }
  section { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  section h2 { margin-top: 0; font-size: 1.05em; }
  label { display: block; margin: 8px 0; }
  input[type=text], input[type=number], input[type=date], select, textarea { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
  .row { border: 1px dashed #bbb; border-radius: 4px; padding: 8px; margin: 8px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .row input, .row select { width: auto; }
  fieldset.row { display: block; }
  fieldset.row label { display: inline-block; margin-right: 12px; }
  button { cursor: pointer; }
  .actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
  button.primary { font-size: 1.05em; padding: 10px 20px; }
  button.secondary { font-size: 0.95em; padding: 10px 16px; background: #fff; border: 1px solid #888; border-radius: 4px; }
  .removeRowBtn { color: #a33; }
  .missing-panel { background: #FFF9E6; border: 1px solid #D9B33B; border-radius: 6px; padding: 10px 14px; margin: 16px 0; font-size: 0.9em; }
  .missing-panel ul { margin: 6px 0 0; padding-left: 20px; }
`;

const CLIENT_SCRIPT = `
function addRow(containerId, templateId) {
  const template = document.getElementById(templateId);
  const container = document.getElementById(containerId);
  const node = template.content.cloneNode(true);
  node.querySelector(".removeRowBtn").addEventListener("click", (e) => {
    e.target.closest(".row").remove();
    refreshMissingFieldsPanel();
  });
  container.appendChild(node);
}

document.getElementById("addOfficerBtn").addEventListener("click", () => {
  addRow("officersContainer", "officerRowTemplate");
  refreshMissingFieldsPanel();
});
document.getElementById("addOfficeBtn").addEventListener("click", () => {
  addRow("officesContainer", "officeRowTemplate");
  refreshMissingFieldsPanel();
});
document.getElementById("addConstructionHistoryBtn").addEventListener("click", () => {
  addRow("constructionHistoryContainer", "constructionHistoryRowTemplate");
  refreshMissingFieldsPanel();
});

function fillOfficerRow(row, officer) {
  row.querySelector(".officer-name").value = officer.name || "";
  row.querySelector(".officer-title").value = officer.title || "";
  row.querySelector(".officer-birthDate").value = officer.birthDate || "";
}

function fillOfficeRow(row, office) {
  row.querySelector(".office-officeName").value = office.officeName || "";
  row.querySelector(".office-personName").value = office.personName || "";
  row.querySelector(".office-licenseType").value = office.licenseType || "一般";
  row.querySelector(".office-hasNationalLicense").checked = !!office.hasNationalLicense;
  row.querySelector(".office-isDesignatedCourseGraduate").checked = !!office.isDesignatedCourseGraduate;
  row.querySelector(".office-educationLevel").value = office.educationLevel || "";
  row.querySelector(".office-yearsOfPracticalExperience").value = office.yearsOfPracticalExperience ?? 0;
  row.querySelector(".office-yearsOfGeneralExperience").value = office.yearsOfGeneralExperience ?? 0;
  row.querySelector(".office-yearsOfSupervisoryExperience").value = office.yearsOfSupervisoryExperience ?? 0;
}

function fillConstructionHistoryRow(row, record) {
  row.querySelector(".ch-constructionType").value = record.constructionType || "";
  row.querySelector(".ch-isSubcontract").value = record.isSubcontract ? "true" : "false";
  row.querySelector(".ch-orderer").value = record.orderer || "";
  row.querySelector(".ch-projectName").value = record.projectName || "";
  row.querySelector(".ch-contractAmount").value = record.contractAmount ?? 0;
  row.querySelector(".ch-startDateIso").value = record.startDateIso || "";
  row.querySelector(".ch-completionDateIso").value = record.completionDateIso || "";
  row.querySelector(".ch-assignedEngineerName").value = record.assignedEngineerName || "";
  row.querySelector(".ch-engineerRole").value = record.engineerRole || "";
}

// 役員・営業所の行を用意する。下書きから復元する場合はその件数分、
// 通常の新規入力時は分かりやすさのため1件だけ空の行を用意する。
const officers = (INITIAL_PROFILE && INITIAL_PROFILE.officers) || [];
if (officers.length > 0) {
  officers.forEach((officer) => {
    addRow("officersContainer", "officerRowTemplate");
    const rows = document.querySelectorAll("#officersContainer .officer-row");
    fillOfficerRow(rows[rows.length - 1], officer);
  });
} else {
  addRow("officersContainer", "officerRowTemplate");
}

const offices = (INITIAL_PROFILE && INITIAL_PROFILE.senninGijutsushaList) || [];
if (offices.length > 0) {
  offices.forEach((office) => {
    addRow("officesContainer", "officeRowTemplate");
    const rows = document.querySelectorAll("#officesContainer .office-row");
    fillOfficeRow(rows[rows.length - 1], office);
  });
} else {
  addRow("officesContainer", "officeRowTemplate");
}

// 工事経歴は任意項目のため、役員・営業所と異なり新規入力時に空行を
// 1件も用意しない（新規申請者は工事実績が無いことも多いため）。
const constructionHistory = (INITIAL_PROFILE && INITIAL_PROFILE.constructionHistory) || [];
constructionHistory.forEach((record) => {
  addRow("constructionHistoryContainer", "constructionHistoryRowTemplate");
  const rows = document.querySelectorAll("#constructionHistoryContainer .construction-history-row");
  fillConstructionHistoryRow(rows[rows.length - 1], record);
});

// 下書きからの基本情報・各要件セクションの復元。
if (INITIAL_PROFILE) {
  const setVal = (id, value) => { document.getElementById(id).value = value ?? ""; };
  const setChecked = (id, value) => { document.getElementById(id).checked = !!value; };
  const p = INITIAL_PROFILE;
  const k = p.keieiGyomuKanri || {};
  const z = p.zaisanKiso || {};
  const kk = p.kekkaku || {};
  const s = p.seijitsusei || {};

  setVal("applicantName", p.applicantName);
  setVal("representativeName", p.representativeName);
  setVal("address", p.address);
  setVal("prefecture", p.prefecture);
  setVal("applicationDate", p.applicationDate);
  setVal("constructionTypes", (p.constructionTypes || []).join("、"));

  setVal("yearsAsResponsibleOfficer", k.yearsAsResponsibleOfficer ?? 0);
  setVal("yearsAsQuasiResponsibleOfficer", k.yearsAsQuasiResponsibleOfficer ?? 0);
  setVal("yearsAsAssistant", k.yearsAsAssistant ?? 0);
  setChecked("isOfficerFor2Years", k.isOfficerFor2Years);
  const support = k.assistantSupportYears || {};
  setVal("assistantSupportYearsFinance", support.finance ?? 0);
  setVal("assistantSupportYearsLabor", support.labor ?? 0);
  setVal("assistantSupportYearsOperations", support.operations ?? 0);
  setChecked("hasSocialInsurance", k.hasSocialInsurance);
  setVal("responsibleName", k.responsibleName);
  setVal("responsibleTitle", k.responsibleTitle);

  setVal("zaisanLicenseType", z.licenseType || "一般");
  setVal("netAssets", z.netAssets ?? 0);
  setVal("fundingCapacity", z.fundingCapacity ?? 0);
  setChecked("hasFiveYearsContinuousOperation", z.hasFiveYearsContinuousOperation);
  setVal("capitalAmount", z.capitalAmount ?? 0);
  setVal("deficitRatio", z.deficitRatio ?? 0);
  setVal("currentRatio", z.currentRatio ?? 0);

  setChecked("isUndischargedBankrupt", kk.isUndischargedBankrupt);
  setChecked("hadLicenseRevokedWithin5Years", kk.hadLicenseRevokedWithin5Years);
  setChecked("hasWithdrawnLicenseDuringRevocationHearingWithin5Years", kk.hasWithdrawnLicenseDuringRevocationHearingWithin5Years);
  setChecked("hasBusinessSuspensionOrderInEffect", kk.hasBusinessSuspensionOrderInEffect);
  setChecked("hasBusinessProhibitionOrderInEffect", kk.hasBusinessProhibitionOrderInEffect);
  setChecked("hasCriminalRecordWithin5Years", kk.hasCriminalRecordWithin5Years);
  setChecked("isBoryokudanMemberOrWithin5Years", kk.isBoryokudanMemberOrWithin5Years);
  setChecked("hasMentalImpairmentAffectingDuties", kk.hasMentalImpairmentAffectingDuties);
  setChecked("isControlledByBoryokudanMember", kk.isControlledByBoryokudanMember);
  setChecked("hasFalseOrOmittedStatement", kk.hasFalseOrOmittedStatement);

  setChecked("hasNoDishonestActRisk", s.hasNoDishonestActRisk);
  setVal("seijitsuseiNotes", s.notes);

  // 完成工事原価報告書（任意項目）。労務外注費・人件費の内訳は未入力状態を
  // 「0」ではなく空欄のまま保つ（他の必須項目は0を既定値とするが、
  // これらは「内訳を申告しない」ことと「0円」を区別するため）。
  const cc = p.completedConstructionCost || {};
  setVal("ccMaterialCost", cc.materialCost ?? 0);
  setVal("ccLaborCost", cc.laborCost ?? 0);
  setVal("ccSubcontractedLaborCost", cc.subcontractedLaborCost);
  setVal("ccSubcontractCost", cc.subcontractCost ?? 0);
  setVal("ccExpenses", cc.expenses ?? 0);
  setVal("ccPersonnelExpenses", cc.personnelExpenses);
}

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

function collectConstructionHistory() {
  return Array.from(document.querySelectorAll("#constructionHistoryContainer .construction-history-row")).map((row) => {
    const record = {
      constructionType: row.querySelector(".ch-constructionType").value,
      isSubcontract: row.querySelector(".ch-isSubcontract").value === "true",
      orderer: row.querySelector(".ch-orderer").value,
      projectName: row.querySelector(".ch-projectName").value,
      contractAmount: Number(row.querySelector(".ch-contractAmount").value) || 0,
      completionDateIso: row.querySelector(".ch-completionDateIso").value,
    };
    const startDateIso = row.querySelector(".ch-startDateIso").value;
    if (startDateIso) record.startDateIso = startDateIso;
    const assignedEngineerName = row.querySelector(".ch-assignedEngineerName").value;
    if (assignedEngineerName) record.assignedEngineerName = assignedEngineerName;
    const engineerRole = row.querySelector(".ch-engineerRole").value;
    if (engineerRole) record.engineerRole = engineerRole;
    return record;
  });
}

function buildProfile() {
  const num = (id) => Number(document.getElementById(id).value) || 0;
  const optionalNum = (id) => {
    const raw = document.getElementById(id).value;
    return raw === "" ? undefined : Number(raw);
  };
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
    constructionHistory: collectConstructionHistory(),
    completedConstructionCost: {
      materialCost: num("ccMaterialCost"),
      laborCost: num("ccLaborCost"),
      subcontractedLaborCost: optionalNum("ccSubcontractedLaborCost"),
      subcontractCost: num("ccSubcontractCost"),
      expenses: num("ccExpenses"),
      personnelExpenses: optionalNum("ccPersonnelExpenses"),
    },
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
      hasWithdrawnLicenseDuringRevocationHearingWithin5Years: checked("hasWithdrawnLicenseDuringRevocationHearingWithin5Years"),
      hasBusinessSuspensionOrderInEffect: checked("hasBusinessSuspensionOrderInEffect"),
      hasBusinessProhibitionOrderInEffect: checked("hasBusinessProhibitionOrderInEffect"),
      hasCriminalRecordWithin5Years: checked("hasCriminalRecordWithin5Years"),
      isBoryokudanMemberOrWithin5Years: checked("isBoryokudanMemberOrWithin5Years"),
      hasMentalImpairmentAffectingDuties: checked("hasMentalImpairmentAffectingDuties"),
      isControlledByBoryokudanMember: checked("isControlledByBoryokudanMember"),
      hasFalseOrOmittedStatement: checked("hasFalseOrOmittedStatement"),
    },
    seijitsusei: {
      hasNoDishonestActRisk: checked("hasNoDishonestActRisk"),
      notes: str("seijitsuseiNotes"),
    },
  };
}

// 未入力チェック（送信をブロックしない、気づきのための表示のみ）。
function computeMissingFieldLabels() {
  const missing = [];
  const isBlank = (id) => !document.getElementById(id).value.trim();

  if (isBlank("representativeName")) missing.push("代表者氏名");
  if (isBlank("address")) missing.push("主たる営業所の所在地");
  if (isBlank("prefecture")) missing.push("許可行政庁（都道府県）");
  if (isBlank("applicationDate")) missing.push("申請年月日");
  if (isBlank("constructionTypes")) missing.push("許可を受けようとする建設業の種類");
  if (isBlank("responsibleName")) missing.push("経営業務管理体制: 証明を受ける者の氏名");

  document.querySelectorAll("#officersContainer .officer-row").forEach((row, i) => {
    if (!row.querySelector(".officer-name").value.trim()) missing.push("役員 " + (i + 1) + " の氏名");
    if (!row.querySelector(".officer-title").value.trim()) missing.push("役員 " + (i + 1) + " の役名");
  });
  document.querySelectorAll("#officesContainer .office-row").forEach((row, i) => {
    const label = row.querySelector(".office-officeName").value.trim() || "営業所 " + (i + 1);
    if (!row.querySelector(".office-officeName").value.trim()) missing.push("営業所 " + (i + 1) + " の営業所名");
    if (!row.querySelector(".office-personName").value.trim()) missing.push(label + " の専任技術者の氏名");
  });
  document.querySelectorAll("#constructionHistoryContainer .construction-history-row").forEach((row, i) => {
    const label = row.querySelector(".ch-projectName").value.trim() || "工事 " + (i + 1);
    if (!row.querySelector(".ch-constructionType").value.trim()) missing.push(label + " の建設工事の種類");
    if (!row.querySelector(".ch-orderer").value.trim()) missing.push(label + " の注文者");
    if (!row.querySelector(".ch-projectName").value.trim()) missing.push("工事 " + (i + 1) + " の工事名");
    if (!row.querySelector(".ch-completionDateIso").value.trim()) missing.push(label + " の工期（完成年月）");
  });

  return missing;
}

function refreshMissingFieldsPanel() {
  const panel = document.getElementById("missingFieldsPanel");
  const missing = computeMissingFieldLabels();
  if (missing.length === 0) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  panel.innerHTML =
    "以下の項目が未入力です（生成後は「（未入力）」と表示されます。送信は妨げません）:" +
    "<ul>" + missing.map((m) => "<li>" + m.replace(/</g, "&lt;") + "</li>").join("") + "</ul>";
}

document.getElementById("applicantForm").addEventListener("input", refreshMissingFieldsPanel);
refreshMissingFieldsPanel();

document.getElementById("applicantForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
