/**
 * 産業廃棄物収集運搬業許可（廃棄物処理法第14条第1項）のインテイク用Webフォーム（画面）。
 *
 * 農地転用許可の`nouchiTenyoFormPage.js`・古物商許可の`kobutsuFormPage.js`と
 * 同じ設計方針を踏襲する（#291。親Issue #233）。
 * - フレームワーク・ビルドステップは導入しない（NFR-1）。素のHTML/CSS/JSのみ。
 * - フォームの値は送信直前にブラウザ側のJavaScriptで
 *   `SanpaiApplicantProfile`型と同じ構造のJSONに組み立て、hiddenフィールド
 *   経由で通常のPOSTとして送信する（ADR-0002）。判定は既存の`eligibility/`を
 *   サーバー側で呼び、画面側では再実装しない。
 * - 特別管理産業廃棄物・積替え保管を伴う許可は対象外（`eligibility/types.js`冒頭の注記）。
 * - 通信は常にローカルホスト内で完結する（NFR-4: 外部送信をしない）。
 * - 下書き保存機能（`/drafts`）は他の許可種別と共通の`draftStore.js`を使う。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * 欠格事由（廃棄物処理法第14条第5項第2号）のチェック欄。
 * キーは`SanpaiKekkakuInput`のプロパティ名と一致させる（ADR-0002）。
 * @type {[string, string][]}
 */
const KEKKAKU_ITEMS = [
  ["hasMentalImpairmentAffectingDuties", "心身の故障により業務を適切に行うことができない（7条5項4号イ）"],
  ["isUndischargedBankrupt", "破産手続開始の決定を受けて復権を得ていない（7条5項4号ロ）"],
  ["hasCriminalRecordWithin5Years", "拘禁刑以上の刑に処せられ、執行終了等から5年を経過していない（7条5項4号ハ）"],
  ["hasWasteLawViolationWithin5Years", "廃棄物処理法・浄化槽法等の違反や特定の暴力犯罪で罰金刑に処せられ、5年を経過していない（7条5項4号ニ）"],
  ["hadPermitRevokedWithin5Years", "許可の取消しから5年を経過していない（7条5項4号ホ）"],
  ["hasBusinessClosureDuringRevocationProcessWithin5Years", "許可取消しの手続中に事業廃止の届出をしてから5年を経過していない（7条5項4号ヘ・ト）"],
  ["hasDishonestConductRisk", "業務に関し不正又は不誠実な行為をするおそれがあると認めるに足りる相当の理由がある（7条5項4号チ）"],
  ["isBoryokudanRelated", "暴力団員、又は暴力団員でなくなった日から5年を経過していない（14条5項2号ロ）"],
];

/**
 * 産業廃棄物収集運搬業許可のインテイクフォームのHTMLページを返す。
 * @param {{ error?: string, profile?: import('../licenses/sanpai/eligibility/types.js').SanpaiApplicantProfile, draftId?: string, savedNotice?: boolean }} [options]
 * @returns {string}
 */
export function renderSanpaiFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";
  const savedNoticeBlock = options.savedNotice ? `<div class="saved-notice">下書きを保存しました。</div>` : "";

  const initialProfileJson = JSON.stringify(options.profile ?? null).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>kensetsu-kyoka-toolkit — 産業廃棄物収集運搬業許可 申請者情報インテイク</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>産業廃棄物収集運搬業許可 申請者情報インテイク</h1>
  <p class="notice">
    ※ この画面の判定結果は「申請前の一次スクリーニング」に過ぎません。
    特別管理産業廃棄物・積替え保管を伴う許可は対象外です。許可の最終判断は都道府県知事（政令市長）が行います。
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
<form id="sanpaiForm" method="POST" action="/sanpai/submit">
  <input type="hidden" name="profileJson" id="profileJson">
  <input type="hidden" name="licenseCategory" value="sanpai">
  <input type="hidden" name="draftId" id="draftId" value="${escapeHtml(options.draftId ?? "")}">

  <section>
    <h2>1. 基本情報</h2>
    <label>申請者氏名または法人名 <input type="text" id="applicantName" required></label>
    <label>代表者氏名（法人の場合） <input type="text" id="representativeName"></label>
    <label>住所 <input type="text" id="address"></label>
    <label>活動予定の都道府県（例: 愛知県） <input type="text" id="prefecture"></label>
    <label>取り扱う産業廃棄物の種類（読点「、」区切り。例: がれき類、木くず） <input type="text" id="wasteTypes"></label>
  </section>

  <section>
    <h2>2. 欠格事由（該当するものにチェック。廃棄物処理法第14条第5項第2号）</h2>
    ${KEKKAKU_ITEMS.map(([id, label]) => `<label><input type="checkbox" id="${id}"> ${escapeHtml(label)}</label>`).join("\n    ")}
  </section>

  <section>
    <h2>3. 講習修了（JWセンターの講習修了証）</h2>
    <label>講習修了証の発行年月日 <input type="date" id="completionDateIso" required></label>
    <label>申請予定日 <input type="date" id="plannedApplicationDateIso" required></label>
  </section>

  <section>
    <h2>4. 経理的基礎（直近期）</h2>
    <label>直近期の自己資本額（円。債務超過の場合はマイナス） <input type="number" id="latestNetAssets" step="1" required></label>
    <label>直近期の営業損益（円。任意・参考値） <input type="number" id="latestOperatingIncome" step="1"></label>
  </section>

  <section>
    <h2>5. 運搬施設</h2>
    <label class="inline"><input type="checkbox" id="hasOdorSpillPreventionMeasures"> 運搬容器に飛散・流出・悪臭の防止措置がある</label>
    <h3>運搬車両（事業計画書用。1台以上）</h3>
    <div id="vehicleContainer"></div>
    <button type="button" id="addVehicleBtn">＋ 運搬車両を追加</button>
  </section>

  <div class="actions">
    <button type="submit" class="primary">要件判定＋書類サマリーを生成する</button>
    <button type="submit" formaction="/drafts" formnovalidate class="secondary">下書きとして保存</button>
  </div>
</form>
</main>

<template id="vehicleRowTemplate">
  <fieldset class="row vehicle-row">
    <legend>運搬車両</legend>
    <label>車両の種類（例: 4tダンプ） <input type="text" class="vehicle-vehicleType"></label>
    <label>登録番号 <input type="text" class="vehicle-plateNumber"></label>
    <label class="inline"><input type="checkbox" class="vehicle-hasSpillPreventionMeasures"> 飛散・流出防止措置がある</label>
    <button type="button" class="removeRowBtn">削除</button>
  </fieldset>
</template>

<script>
  const INITIAL_PROFILE = ${initialProfileJson};
  const KEKKAKU_IDS = ${JSON.stringify(KEKKAKU_ITEMS.map(([id]) => id))};
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
  section h3 { font-size: 1em; }
  label { display: block; margin: 8px 0; }
  label.inline { display: block; }
  input[type=text], input[type=number], input[type=date], select { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
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

document.getElementById("addVehicleBtn").addEventListener("click", () => addRow("vehicleContainer", "vehicleRowTemplate"));

function collectVehicles() {
  return Array.from(document.querySelectorAll("#vehicleContainer .vehicle-row"))
    .map((row) => {
      const vehicleType = row.querySelector(".vehicle-vehicleType").value;
      const plateNumber = row.querySelector(".vehicle-plateNumber").value;
      if (!vehicleType && !plateNumber) return null;
      return {
        vehicleType,
        plateNumber,
        hasSpillPreventionMeasures: row.querySelector(".vehicle-hasSpillPreventionMeasures").checked,
      };
    })
    .filter((item) => item !== null);
}

function buildProfile() {
  const str = (id) => document.getElementById(id).value || undefined;
  const num = (id) => (document.getElementById(id).value ? Number(document.getElementById(id).value) : undefined);
  const checked = (id) => document.getElementById(id).checked;

  const kekkaku = {};
  for (const id of KEKKAKU_IDS) kekkaku[id] = checked(id);

  const wasteTypes = (document.getElementById("wasteTypes").value || "")
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter((s) => s);

  return {
    applicantName: document.getElementById("applicantName").value,
    representativeName: str("representativeName"),
    address: str("address"),
    prefecture: str("prefecture"),
    kekkaku,
    koushu: {
      completionDateIso: document.getElementById("completionDateIso").value,
      plannedApplicationDateIso: document.getElementById("plannedApplicationDateIso").value,
    },
    keiriKiso: {
      // 空欄は0円として扱う（債務超過＝マイナスのときだけ不足になる判定のため、下書き保存時の空欄の受け皿）。
      latestNetAssets: num("latestNetAssets") ?? 0,
      latestOperatingIncome: num("latestOperatingIncome"),
    },
    hasOdorSpillPreventionMeasures: checked("hasOdorSpillPreventionMeasures"),
    vehicles: collectVehicles(),
    wasteTypes: wasteTypes.length > 0 ? wasteTypes : undefined,
  };
}

// 下書きからの復元。
if (INITIAL_PROFILE) {
  const setVal = (id, value) => { document.getElementById(id).value = value ?? ""; };
  const setChecked = (id, value) => { document.getElementById(id).checked = !!value; };
  const p = INITIAL_PROFILE;
  const kk = p.kekkaku || {};
  const ko = p.koushu || {};
  const ke = p.keiriKiso || {};

  setVal("applicantName", p.applicantName);
  setVal("representativeName", p.representativeName);
  setVal("address", p.address);
  setVal("prefecture", p.prefecture);
  setVal("wasteTypes", (p.wasteTypes || []).join("、"));
  for (const id of KEKKAKU_IDS) setChecked(id, kk[id]);
  setVal("completionDateIso", ko.completionDateIso);
  setVal("plannedApplicationDateIso", ko.plannedApplicationDateIso);
  setVal("latestNetAssets", ke.latestNetAssets);
  setVal("latestOperatingIncome", ke.latestOperatingIncome);
  setChecked("hasOdorSpillPreventionMeasures", p.hasOdorSpillPreventionMeasures);
  for (const v of p.vehicles || []) {
    addRow("vehicleContainer", "vehicleRowTemplate", {
      "vehicle-vehicleType": v.vehicleType,
      "vehicle-plateNumber": v.plateNumber,
      "vehicle-hasSpillPreventionMeasures": v.hasSpillPreventionMeasures,
    });
  }
}

// 車両が1台も無ければ、入力欄を1行出しておく（事業計画書は1台以上が前提）。
if (!document.querySelector("#vehicleContainer .vehicle-row")) addRow("vehicleContainer", "vehicleRowTemplate");

document.getElementById("sanpaiForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
