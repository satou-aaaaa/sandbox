/**
 * 住宅宿泊事業（民泊）届出（住宅宿泊事業法第3条第1項）のインテイク用Webフォーム（画面）。
 *
 * 産廃許可の`sanpaiFormPage.js`・農地転用許可の`nouchiTenyoFormPage.js`と
 * 同じ設計方針を踏襲する（#292。親Issue #233）。
 * - フレームワーク・ビルドステップは導入しない（NFR-1）。素のHTML/CSS/JSのみ。
 * - フォームの値は送信直前にブラウザ側のJavaScriptで
 *   `MinpakuApplicantProfile`型と同じ構造のJSONに組み立て、hiddenフィールド
 *   経由で通常のPOSTとして送信する（ADR-0002）。判定は既存の`eligibility/`を
 *   サーバー側で呼び、画面側では再実装しない。
 * - 届出制のため、結果は合否ではなく「届出の準備が整っているか」の確認
 *   （docs/REQUIREMENTS_minpaku-core.md 1.2節）。
 * - 通信は常にローカルホスト内で完結する（NFR-4: 外部送信をしない）。
 * - 下書き保存機能（`/drafts`）は他の許可種別と共通の`draftStore.js`を使う。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * 欠格事由（住宅宿泊事業法第4条）のチェック欄。
 * キーは`MinpakuKekkakuInput`のプロパティ名と一致させる（ADR-0002）。
 * @type {[string, string][]}
 */
const KEKKAKU_ITEMS = [
  ["hasMentalOrPhysicalImpairment", "心身の故障により住宅宿泊事業を的確に遂行することができない（4条1号）"],
  ["isUndischargedBankrupt", "破産手続開始の決定を受けて復権を得ていない（4条2号）"],
  ["hadBusinessSuspensionOrderWithin3Years", "住宅宿泊事業の廃止命令を受けてから3年を経過していない（4条3号）"],
  ["hasCriminalRecordWithin3Years", "拘禁刑以上の刑、又は本法・旅館業法違反の罰金刑から3年を経過していない（4条4号）"],
  ["isBoryokudanRelated", "暴力団員、又は暴力団員でなくなった日から5年を経過していない（4条5号）"],
];

/**
 * 必要書類の初期行（docs/REQUIREMENTS_minpaku-core.md FR-M1.3 に挙げる代表的な書類）。
 * 届出先によって追加・不要の書類があるため、画面で行の追加・削除ができる。
 * @type {{ key: string, label: string }[]}
 */
const DEFAULT_REQUIRED_DOCUMENTS = [
  { key: "touki-jikou-shomeisho", label: "登記事項証明書" },
  { key: "zumen", label: "図面" },
  { key: "shobo-hoi-tsuchisho", label: "消防法令適合通知書" },
  { key: "seiyakusho", label: "誓約書" },
];

/**
 * 住宅宿泊事業（民泊）届出のインテイクフォームのHTMLページを返す。
 * @param {{ error?: string, profile?: import('../licenses/minpaku/eligibility/types.js').MinpakuApplicantProfile, draftId?: string, savedNotice?: boolean }} [options]
 * @returns {string}
 */
export function renderMinpakuFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";
  const savedNoticeBlock = options.savedNotice ? `<div class="saved-notice">下書きを保存しました。</div>` : "";

  const initialProfileJson = JSON.stringify(options.profile ?? null).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>kensetsu-kyoka-toolkit — 住宅宿泊事業（民泊）届出 届出者情報インテイク</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>住宅宿泊事業（民泊）届出 届出者情報インテイク</h1>
  <p class="notice">
    ※ この画面の結果は「届出前の準備状況の確認」に過ぎません（届出制のため合否判定ではありません）。
    最終的な内容確認・提出は必ず登録行政書士本人が行ってください。
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
<form id="minpakuForm" method="POST" action="/minpaku/submit">
  <input type="hidden" name="profileJson" id="profileJson">
  <input type="hidden" name="licenseCategory" value="minpaku">
  <input type="hidden" name="draftId" id="draftId" value="${escapeHtml(options.draftId ?? "")}">

  <section>
    <h2>1. 基本情報</h2>
    <label>届出者氏名または法人名 <input type="text" id="applicantName" required></label>
    <label>住所 <input type="text" id="address"></label>
    <label>届出住宅の所在地 <input type="text" id="propertyAddress"></label>
  </section>

  <section>
    <h2>2. 家主居住型／家主不在型（住宅宿泊事業法第11条）</h2>
    <label>種別
      <select id="residentType">
        <option value="家主居住型">家主居住型</option>
        <option value="家主不在型">家主不在型</option>
      </select>
    </label>
    <label>委託先の住宅宿泊管理業者名（家主不在型の場合） <input type="text" id="managementCompanyName"></label>
  </section>

  <section>
    <h2>3. 欠格事由（該当するものにチェック。住宅宿泊事業法第4条）</h2>
    ${KEKKAKU_ITEMS.map(([id, label]) => `<label><input type="checkbox" id="${id}"> ${escapeHtml(label)}</label>`).join("\n    ")}
  </section>

  <section>
    <h2>4. 必要書類（住宅宿泊事業法施行規則第4条）</h2>
    <div id="documentContainer"></div>
    <button type="button" id="addDocumentBtn">＋ 書類を追加</button>
  </section>

  <div class="actions">
    <button type="submit" class="primary">準備状況の確認＋書類サマリーを生成する</button>
    <button type="submit" formaction="/drafts" formnovalidate class="secondary">下書きとして保存</button>
  </div>
</form>
</main>

<template id="documentRowTemplate">
  <fieldset class="row document-row">
    <legend>書類</legend>
    <input type="hidden" class="document-key">
    <label>書類名 <input type="text" class="document-label"></label>
    <label class="inline"><input type="checkbox" class="document-obtained"> 取得済み</label>
    <label class="inline"><input type="checkbox" class="document-isForeignLanguage"> 外国語で発行された書類（日本語訳が必要）</label>
    <button type="button" class="removeRowBtn">削除</button>
  </fieldset>
</template>

<script>
  const INITIAL_PROFILE = ${initialProfileJson};
  const KEKKAKU_IDS = ${JSON.stringify(KEKKAKU_ITEMS.map(([id]) => id))};
  const DEFAULT_REQUIRED_DOCUMENTS = ${JSON.stringify(DEFAULT_REQUIRED_DOCUMENTS)};
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
  input[type=text], select { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
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

document.getElementById("addDocumentBtn").addEventListener("click", () => addRow("documentContainer", "documentRowTemplate"));

function collectDocuments() {
  return Array.from(document.querySelectorAll("#documentContainer .document-row"))
    .map((row, index) => {
      const label = row.querySelector(".document-label").value;
      if (!label) return null;
      return {
        key: row.querySelector(".document-key").value || "document-" + (index + 1),
        label,
        obtained: row.querySelector(".document-obtained").checked,
        isForeignLanguage: row.querySelector(".document-isForeignLanguage").checked,
      };
    })
    .filter((item) => item !== null);
}

function buildProfile() {
  const str = (id) => document.getElementById(id).value || undefined;
  const checked = (id) => document.getElementById(id).checked;

  const kekkaku = {};
  for (const id of KEKKAKU_IDS) kekkaku[id] = checked(id);

  return {
    applicantName: document.getElementById("applicantName").value,
    address: str("address"),
    propertyAddress: str("propertyAddress"),
    residentType: document.getElementById("residentType").value,
    managementCompanyName: str("managementCompanyName"),
    kekkaku,
    requiredDocuments: collectDocuments(),
  };
}

function addDocumentRow(d) {
  addRow("documentContainer", "documentRowTemplate", {
    "document-key": d.key,
    "document-label": d.label,
    "document-obtained": d.obtained,
    "document-isForeignLanguage": d.isForeignLanguage,
  });
}

// 下書きからの復元。
if (INITIAL_PROFILE) {
  const setVal = (id, value) => { document.getElementById(id).value = value ?? ""; };
  const setChecked = (id, value) => { document.getElementById(id).checked = !!value; };
  const p = INITIAL_PROFILE;
  const kk = p.kekkaku || {};

  setVal("applicantName", p.applicantName);
  setVal("address", p.address);
  setVal("propertyAddress", p.propertyAddress);
  if (p.residentType) setVal("residentType", p.residentType);
  setVal("managementCompanyName", p.managementCompanyName);
  for (const id of KEKKAKU_IDS) setChecked(id, kk[id]);
  for (const d of p.requiredDocuments || []) addDocumentRow(d);
}

// 書類の行が1つも無ければ、代表的な書類を初期行として出しておく。
if (!document.querySelector("#documentContainer .document-row")) {
  for (const d of DEFAULT_REQUIRED_DOCUMENTS) addDocumentRow(d);
}

document.getElementById("minpakuForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
