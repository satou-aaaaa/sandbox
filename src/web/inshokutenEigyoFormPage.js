/**
 * 飲食店営業許可（食品衛生法第55条）のインテイク用Webフォーム（画面）。
 *
 * 農地転用許可の`nouchiTenyoFormPage.js`・古物商許可の`kobutsuFormPage.js`と
 * 同じ設計方針を踏襲する（#290。親Issue #233）。
 * - フレームワーク・ビルドステップは導入しない（NFR-1）。素のHTML/CSS/JSのみ。
 * - フォームの値は送信直前にブラウザ側のJavaScriptで
 *   `InshokutenApplicantProfile`型と同じ構造のJSONに組み立て、hiddenフィールド
 *   経由で通常のPOSTとして送信する（ADR-0002）。判定は既存の`eligibility/`を
 *   サーバー側で呼び、画面側では再実装しない。
 * - HACCP関連の入力欄は意図的に置かない。HACCPに沿った衛生管理は許可要件ではなく
 *   食品衛生法第51条の継続義務であるため（`eligibility/types.js`冒頭の注記）。
 * - 通信は常にローカルホスト内で完結する（NFR-4: 外部送信をしない）。
 * - 下書き保存機能（`/drafts`）は他の許可種別と共通の`draftStore.js`を使う。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * `SekininshaInput.qualificationType` の選択肢。触らずに送っても資格があることにならないよう、
 * 「未定」を先頭（初期値）に置く。
 */
const QUALIFICATION_OPTIONS = ["未定", "調理師", "製菓衛生師", "栄養士", "講習会受講修了"];

/**
 * 飲食店営業許可のインテイクフォームのHTMLページを返す。
 * @param {{ error?: string, profile?: import('../licenses/inshokuten-eigyo/eligibility/types.js').InshokutenApplicantProfile, draftId?: string, savedNotice?: boolean }} [options]
 * @returns {string}
 */
export function renderInshokutenEigyoFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";
  const savedNoticeBlock = options.savedNotice ? `<div class="saved-notice">下書きを保存しました。</div>` : "";

  const initialProfileJson = JSON.stringify(options.profile ?? null).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>kensetsu-kyoka-toolkit — 飲食店営業許可 申請者情報インテイク</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>飲食店営業許可 申請者情報インテイク</h1>
  <p class="notice">
    ※ この画面の判定結果は「申請前の一次スクリーニング」に過ぎません。
    施設基準の具体的な数値は自治体の条例により異なり、許可の最終判断は管轄の保健所が行います。
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
<form id="inshokutenEigyoForm" method="POST" action="/inshokuten-eigyo/submit">
  <input type="hidden" name="profileJson" id="profileJson">
  <input type="hidden" name="licenseCategory" value="inshokuten-eigyo">
  <input type="hidden" name="draftId" id="draftId" value="${escapeHtml(options.draftId ?? "")}">

  <section>
    <h2>1. 基本情報</h2>
    <label>申請者（営業者）氏名または法人名 <input type="text" id="applicantName" required></label>
    <label>屋号（店舗名。任意） <input type="text" id="businessName"></label>
    <label>営業所（店舗）所在地 <input type="text" id="storeAddress" required></label>
    <label>管轄保健所の自治体名（例: 東京都） <input type="text" id="municipalityName" required></label>
    <label>電話番号（任意） <input type="text" id="phoneNumber"></label>
    <label>開業予定日（任意） <input type="date" id="plannedOpeningDateIso"></label>
  </section>

  <section>
    <h2>2. 施設基準（保健所への事前相談等で確認した内容）</h2>
    <label>洗浄・すすぎ用のシンクの数 <input type="number" id="sinkCount" min="0" step="1" required></label>
    <label class="inline"><input type="checkbox" id="hasNonTouchHandwashing"> 手洗い設備が洗浄後の手指の再汚染を防げる構造（レバー式・肘操作式・自動センサー式等）である</label>
    <label class="inline"><input type="checkbox" id="hasWashableWallFloorMaterial"> 床・壁・天井が耐水性で清掃しやすい材質である</label>
    <label class="inline"><input type="checkbox" id="hasAdequateVentilation"> 適切な換気設備がある</label>
    <label>調理場の照度（ルクス。任意） <input type="number" id="lightingLux" min="0" step="1"></label>
    <label class="inline"><input type="checkbox" id="hasProperDrainage"> 適切な給排水設備・グリストラップがある</label>
    <label class="inline"><input type="checkbox" id="usesTankOrWellWater"> 貯水槽水・井戸水を使用する</label>
    <label class="inline"><input type="checkbox" id="hasWaterQualityTestReport"> （貯水槽水・井戸水を使用する場合）水質検査成績書を準備済み</label>
  </section>

  <section>
    <h2>3. 食品衛生責任者</h2>
    <label>食品衛生責任者の氏名 <input type="text" id="sekininshaName"></label>
    <label>資格の種別
      <select id="qualificationType">
        ${QUALIFICATION_OPTIONS.map((q) => `<option value="${escapeHtml(q)}">${escapeHtml(q)}</option>`).join("\n        ")}
      </select>
    </label>
    <label class="inline"><input type="checkbox" id="isDesignatedPerStore"> 当該店舗専属で設置されている</label>
  </section>

  <div class="actions">
    <button type="submit" class="primary">要件判定＋書類サマリーを生成する</button>
    <button type="submit" formaction="/drafts" formnovalidate class="secondary">下書きとして保存</button>
  </div>
</form>
</main>

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
  input[type=text], input[type=number], input[type=date], select { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
  button { cursor: pointer; }
  .actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
  button.primary { font-size: 1.05em; padding: 10px 20px; }
  button.secondary { font-size: 0.95em; padding: 10px 16px; background: #fff; border: 1px solid #888; border-radius: 4px; }
`;

const CLIENT_SCRIPT = `
function buildProfile() {
  const str = (id) => document.getElementById(id).value || undefined;
  const num = (id) => (document.getElementById(id).value ? Number(document.getElementById(id).value) : undefined);
  const checked = (id) => document.getElementById(id).checked;
  const usesTankOrWellWater = checked("usesTankOrWellWater");

  return {
    applicantName: document.getElementById("applicantName").value,
    businessName: str("businessName"),
    storeAddress: document.getElementById("storeAddress").value,
    municipalityName: document.getElementById("municipalityName").value,
    phoneNumber: str("phoneNumber"),
    plannedOpeningDateIso: str("plannedOpeningDateIso"),
    shisetsu: {
      // 空欄は不足側（0槽）として扱い、要件を満たしたことにしない（下書き保存は空欄のまま送れるため）。
      sinkCount: num("sinkCount") ?? 0,
      hasNonTouchHandwashing: checked("hasNonTouchHandwashing"),
      hasWashableWallFloorMaterial: checked("hasWashableWallFloorMaterial"),
      hasAdequateVentilation: checked("hasAdequateVentilation"),
      lightingLux: num("lightingLux"),
      hasProperDrainage: checked("hasProperDrainage"),
      usesTankOrWellWater,
      // 型の定義どおり、貯水槽水・井戸水を使う場合だけ水質検査成績書の有無を送る。
      hasWaterQualityTestReport: usesTankOrWellWater ? checked("hasWaterQualityTestReport") : undefined,
    },
    sekininsha: {
      name: document.getElementById("sekininshaName").value,
      qualificationType: document.getElementById("qualificationType").value,
      isDesignatedPerStore: checked("isDesignatedPerStore"),
    },
  };
}

// 下書きからの復元。
if (INITIAL_PROFILE) {
  const setVal = (id, value) => { document.getElementById(id).value = value ?? ""; };
  const setChecked = (id, value) => { document.getElementById(id).checked = !!value; };
  const p = INITIAL_PROFILE;
  const sh = p.shisetsu || {};
  const se = p.sekininsha || {};

  setVal("applicantName", p.applicantName);
  setVal("businessName", p.businessName);
  setVal("storeAddress", p.storeAddress);
  setVal("municipalityName", p.municipalityName);
  setVal("phoneNumber", p.phoneNumber);
  setVal("plannedOpeningDateIso", p.plannedOpeningDateIso);

  setVal("sinkCount", sh.sinkCount);
  setChecked("hasNonTouchHandwashing", sh.hasNonTouchHandwashing);
  setChecked("hasWashableWallFloorMaterial", sh.hasWashableWallFloorMaterial);
  setChecked("hasAdequateVentilation", sh.hasAdequateVentilation);
  setVal("lightingLux", sh.lightingLux);
  setChecked("hasProperDrainage", sh.hasProperDrainage);
  setChecked("usesTankOrWellWater", sh.usesTankOrWellWater);
  setChecked("hasWaterQualityTestReport", sh.hasWaterQualityTestReport);

  setVal("sekininshaName", se.name);
  if (se.qualificationType) setVal("qualificationType", se.qualificationType);
  setChecked("isDesignatedPerStore", se.isDesignatedPerStore);
}

document.getElementById("inshokutenEigyoForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
