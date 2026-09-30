/**
 * 古物商許可のインテイク用Webフォーム（画面）。
 *
 * 建設業許可の`formPage.js`（M3）と同じ設計方針を踏襲する。
 * - フレームワーク・ビルドステップは導入しない（NFR-1）。素のHTML/CSS/JSのみ。
 * - フォームの値は送信直前にブラウザ側のJavaScriptで
 *   `KobutsuApplicantProfile`型と同じ構造のJSONに組み立て、hiddenフィールド
 *   経由で通常のPOSTとして送信する。
 * - 通信は常にローカルホスト内で完結する（NFR-4: 外部送信をしない）。
 * - 未入力項目のチェックは行わない（`formPage.js`と異なり、フォーム自体が
 *   建設業許可ほど大規模でないため、まずはシンプルな構成とする。将来
 *   必要になれば同じ「気づきパネル」パターンを追加できる）。
 * - 下書き保存機能（`/drafts`）は建設業許可と共通の`draftStore.js`を使う
 *   （2026年9月・#73。`DraftRecord.licenseCategory`で種別を判別するため、
 *   「続きから入力」が誤った種別のフォームを開くことはない）。
 * - 法人申請は対象外（個人申請のみ）。`eligibility/kekkaku.js`は法人の
 *   役員欠格チェック（第十一号）に2026年9月に対応済みだが、書類生成
 *   モジュール（`shinseisho.js`等）は個人申請の記載項目のみに対応して
 *   おり法人名・役員一覧を出力できないため、書類生成とセットになる
 *   本フォームでは個人申請のみを受け付ける（`docs/DESIGN_kobutsu-core.md`
 *   9章参照。法人の欠格事由判定自体はCLI/スクリプト経由で利用可能）。
 */
import { escapeHtml } from "./htmlUtils.js";

const HANDLED_ITEM_CATEGORIES = [
  "美術品類",
  "衣類",
  "時計・宝飾品類",
  "自動車",
  "自動二輪車及び原動機付自転車",
  "自転車類",
  "写真機類",
  "事務機器類",
  "機械工具類",
  "道具類",
  "皮革・ゴム製品類",
  "書籍",
  "金券類",
];

/**
 * 古物商許可のインテイクフォームのHTMLページを返す。
 * @param {{ error?: string, profile?: import('../licenses/kobutsu/eligibility/types.js').KobutsuApplicantProfile, draftId?: string, savedNotice?: boolean }} [options]
 * @returns {string}
 */
export function renderKobutsuFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";
  const savedNoticeBlock = options.savedNotice ? `<div class="saved-notice">下書きを保存しました。</div>` : "";

  // formPage.js（建設業許可）と同じ理由で"<"をエスケープする。
  const initialProfileJson = JSON.stringify(options.profile ?? null).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>kensetsu-kyoka-toolkit — 古物商許可 申請者情報インテイク</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>古物商許可 申請者情報インテイク</h1>
  <p class="notice">
    ※ この画面の判定結果は「申請前の一次スクリーニング」に過ぎません。
    最終的な適格性の判断・書類の内容確認・提出は必ず登録行政書士本人が行ってください。
    実在の顧客情報を入力する場合、このツールはローカルでのみ動作し外部へは送信しません。
  </p>
  <p>
    <a href="/">← 建設業許可のインテイクフォームへ戻る</a>
    ・ <a href="/drafts">→ 保存済みの下書き一覧を見る</a>
  </p>
</header>
${errorBlock}
${savedNoticeBlock}
<main>
<form id="kobutsuForm" method="POST" action="/kobutsu/submit">
  <input type="hidden" name="profileJson" id="profileJson">
  <input type="hidden" name="licenseCategory" value="kobutsu">
  <input type="hidden" name="draftId" id="draftId" value="${escapeHtml(options.draftId ?? "")}">

  <section>
    <h2>1. 基本情報（個人申請のみ対応。法人申請は非対応）</h2>
    <label>申請者氏名 <input type="text" id="applicantName" required></label>
    <label>フリガナ <input type="text" id="applicantNameKana"></label>
    <label>生年月日 <input type="date" id="birthDate"></label>
    <label>住所 <input type="text" id="address"></label>
    <label>電話番号 <input type="text" id="phoneNumber"></label>
    <label>屋号（任意） <input type="text" id="businessName"></label>
  </section>

  <section>
    <h2>2. 欠格事由（該当するものにチェック。古物営業法第4条）</h2>
    <label><input type="checkbox" id="isUndischargedBankrupt"> 破産手続開始の決定を受けて復権を得ていない</label>
    <label><input type="checkbox" id="hasCriminalRecordWithin5Years"> 拘禁刑以上の刑等により5年を経過していない</label>
    <label><input type="checkbox" id="hasBoryokuFuhouKoiRisk"> 集団的・常習的な暴力的不法行為等のおそれがあると認められる</label>
    <label><input type="checkbox" id="hasBoryokudanRelatedOrderWithin3Years"> 暴力団関連の命令・指示を受けてから3年を経過していない</label>
    <label><input type="checkbox" id="isAddressUnknown"> 住居が定まっていない</label>
    <label><input type="checkbox" id="hadLicenseRevokedWithin5Years"> 許可の取消しから5年を経過していない</label>
    <label><input type="checkbox" id="hasSurrenderedLicenseDuringRevocationHearingWithin5Years"> 許可取消しの聴聞公示後に許可証を返納してから5年を経過していない</label>
    <label><input type="checkbox" id="hasMentalImpairmentAffectingDuties"> 心身の故障により業務を適正に行うことができないと認められる</label>
    <label><input type="checkbox" id="isMinorWithoutCapacity"> 営業に関し成年者と同一の行為能力を有しない未成年者である</label>
    <label><input type="checkbox" id="isHeirWithQualifiedLegalRepresentative"> （↑に該当する場合のみ）古物商・古物市場主の相続人であり、法定代理人が欠格事由に該当しない</label>
  </section>

  <section>
    <h2>3. 営業所の一覧（古物営業法第13条）</h2>
    <div id="eigyoshoContainer"></div>
    <button type="button" id="addEigyoshoBtn">＋ 営業所を追加</button>
  </section>

  <section>
    <h2>4. その他</h2>
    <fieldset>
      <legend>取り扱う古物の区分</legend>
      ${HANDLED_ITEM_CATEGORIES.map(
        (c, i) => `<label class="inline"><input type="checkbox" class="handledItemCategory" value="${escapeHtml(c)}" id="handledItemCategory${i}"> ${escapeHtml(c)}</label>`
      ).join("\n      ")}
    </fieldset>
    <label><input type="checkbox" id="usesInternet"> インターネットを利用して取引を行う</label>
    <label>インターネット利用時のURL（任意） <input type="text" id="url"></label>
    <label>略歴書用の職歴・経歴（過去5年分が目安・任意） <textarea id="representativeHistory" rows="3"></textarea></label>
  </section>

  <div class="actions">
    <button type="submit" class="primary">要件判定＋書類サマリーを生成する</button>
    <button type="submit" formaction="/drafts" formnovalidate class="secondary">下書きとして保存</button>
  </div>
</form>
</main>

<template id="eigyoshoRowTemplate">
  <fieldset class="row eigyosho-row">
    <legend>営業所</legend>
    <label>営業所名 <input type="text" class="eigyosho-officeName"></label>
    <label class="inline"><input type="checkbox" class="eigyosho-hasLegitimateUsageRight"> 営業所の実在性・使用権限を確認済み</label>
    <label>管理者の氏名 <input type="text" class="eigyosho-managerName"></label>
    <label class="inline"><input type="checkbox" class="eigyosho-isManagerFullTime"> 管理者が常勤である</label>
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
  label.inline { display: block; }
  input[type=text], input[type=date], select, textarea { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
  .row { border: 1px dashed #bbb; border-radius: 4px; padding: 8px; margin: 8px 0; }
  .row input[type=text] { width: auto; }
  button { cursor: pointer; }
  .actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
  button.primary { font-size: 1.05em; padding: 10px 20px; }
  button.secondary { font-size: 0.95em; padding: 10px 16px; background: #fff; border: 1px solid #888; border-radius: 4px; }
  .removeRowBtn { color: #a33; margin-top: 8px; }
`;

const CLIENT_SCRIPT = `
function addRow(containerId, templateId, values) {
  const template = document.getElementById(templateId);
  const container = document.getElementById(containerId);
  const node = template.content.cloneNode(true);
  node.querySelector(".removeRowBtn").addEventListener("click", (e) => {
    e.target.closest(".row").remove();
  });
  if (values) {
    for (const [className, value] of Object.entries(values)) {
      const el = node.querySelector("." + className);
      if (!el) continue;
      if (el.type === "checkbox") el.checked = !!value;
      else el.value = value ?? "";
    }
  }
  container.appendChild(node);
}

document.getElementById("addEigyoshoBtn").addEventListener("click", () => addRow("eigyoshoContainer", "eigyoshoRowTemplate"));

// 下書きに営業所の入力があれば復元し、無ければ（新規入力・空フォーム）
// 営業所は1件以上必須のため、最初から1行用意しておく。
const initialEigyoshoList = (INITIAL_PROFILE && INITIAL_PROFILE.eigyoshoList) || [];
if (initialEigyoshoList.length > 0) {
  for (const e of initialEigyoshoList) {
    addRow("eigyoshoContainer", "eigyoshoRowTemplate", {
      "eigyosho-officeName": e.officeName,
      "eigyosho-hasLegitimateUsageRight": e.hasLegitimateUsageRight,
      "eigyosho-managerName": e.managerName,
      "eigyosho-isManagerFullTime": e.isManagerFullTime,
    });
  }
} else {
  addRow("eigyoshoContainer", "eigyoshoRowTemplate");
}

function collectEigyoshoList() {
  return Array.from(document.querySelectorAll("#eigyoshoContainer .eigyosho-row")).map((row) => ({
    officeName: row.querySelector(".eigyosho-officeName").value,
    hasLegitimateUsageRight: row.querySelector(".eigyosho-hasLegitimateUsageRight").checked,
    managerName: row.querySelector(".eigyosho-managerName").value,
    isManagerFullTime: row.querySelector(".eigyosho-isManagerFullTime").checked,
  }));
}

function buildProfile() {
  const str = (id) => document.getElementById(id).value || undefined;
  const checked = (id) => document.getElementById(id).checked;

  const handledItemCategories = Array.from(document.querySelectorAll(".handledItemCategory:checked")).map((el) => el.value);

  return {
    applicantName: document.getElementById("applicantName").value,
    applicantNameKana: str("applicantNameKana"),
    birthDate: str("birthDate"),
    address: str("address"),
    phoneNumber: str("phoneNumber"),
    businessName: str("businessName"),
    kekkaku: {
      isUndischargedBankrupt: checked("isUndischargedBankrupt"),
      hasCriminalRecordWithin5Years: checked("hasCriminalRecordWithin5Years"),
      hasBoryokuFuhouKoiRisk: checked("hasBoryokuFuhouKoiRisk"),
      hasBoryokudanRelatedOrderWithin3Years: checked("hasBoryokudanRelatedOrderWithin3Years"),
      isAddressUnknown: checked("isAddressUnknown"),
      hadLicenseRevokedWithin5Years: checked("hadLicenseRevokedWithin5Years"),
      hasSurrenderedLicenseDuringRevocationHearingWithin5Years: checked("hasSurrenderedLicenseDuringRevocationHearingWithin5Years"),
      hasMentalImpairmentAffectingDuties: checked("hasMentalImpairmentAffectingDuties"),
      isMinorWithoutCapacity: checked("isMinorWithoutCapacity"),
      isHeirWithQualifiedLegalRepresentative: checked("isHeirWithQualifiedLegalRepresentative"),
    },
    eigyoshoList: collectEigyoshoList(),
    handledItemCategories: handledItemCategories.length > 0 ? handledItemCategories : undefined,
    usesInternet: checked("usesInternet"),
    url: str("url"),
    representativeHistory: str("representativeHistory"),
  };
}

// 下書きからの基本情報・欠格事由・その他項目の復元。
if (INITIAL_PROFILE) {
  const setVal = (id, value) => { document.getElementById(id).value = value ?? ""; };
  const setChecked = (id, value) => { document.getElementById(id).checked = !!value; };
  const p = INITIAL_PROFILE;
  const kk = p.kekkaku || {};

  setVal("applicantName", p.applicantName);
  setVal("applicantNameKana", p.applicantNameKana);
  setVal("birthDate", p.birthDate);
  setVal("address", p.address);
  setVal("phoneNumber", p.phoneNumber);
  setVal("businessName", p.businessName);

  setChecked("isUndischargedBankrupt", kk.isUndischargedBankrupt);
  setChecked("hasCriminalRecordWithin5Years", kk.hasCriminalRecordWithin5Years);
  setChecked("hasBoryokuFuhouKoiRisk", kk.hasBoryokuFuhouKoiRisk);
  setChecked("hasBoryokudanRelatedOrderWithin3Years", kk.hasBoryokudanRelatedOrderWithin3Years);
  setChecked("isAddressUnknown", kk.isAddressUnknown);
  setChecked("hadLicenseRevokedWithin5Years", kk.hadLicenseRevokedWithin5Years);
  setChecked("hasSurrenderedLicenseDuringRevocationHearingWithin5Years", kk.hasSurrenderedLicenseDuringRevocationHearingWithin5Years);
  setChecked("hasMentalImpairmentAffectingDuties", kk.hasMentalImpairmentAffectingDuties);
  setChecked("isMinorWithoutCapacity", kk.isMinorWithoutCapacity);
  setChecked("isHeirWithQualifiedLegalRepresentative", kk.isHeirWithQualifiedLegalRepresentative);

  for (const el of document.querySelectorAll(".handledItemCategory")) {
    el.checked = (p.handledItemCategories || []).includes(el.value);
  }
  setChecked("usesInternet", p.usesInternet);
  setVal("url", p.url);
  setVal("representativeHistory", p.representativeHistory);
}

document.getElementById("kobutsuForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
