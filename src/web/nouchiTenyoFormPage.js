/**
 * 農地転用許可のインテイク用Webフォーム（画面）。
 *
 * 古物商許可の`kobutsuFormPage.js`と同じ設計方針を踏襲する。
 * - フレームワーク・ビルドステップは導入しない（NFR-1）。素のHTML/CSS/JSのみ。
 * - フォームの値は送信直前にブラウザ側のJavaScriptで
 *   `NouchiTenyoApplicantProfile`型と同じ構造のJSONに組み立て、hiddenフィールド
 *   経由で通常のPOSTとして送信する。
 * - 通信は常にローカルホスト内で完結する（NFR-4: 外部送信をしない）。
 * - 下書き保存機能（`/drafts`）は本フォームでは対象外（`kobutsuFormPage.js`と
 *   同じ理由。既存の`/drafts`は建設業許可専用のプロフィール型を前提としており、
 *   プロフィールの種類を区別する仕組みが無いため安易に共有しない）。
 */
import { escapeHtml } from "./htmlUtils.js";

const NOUCHI_KUBUN_OPTIONS = ["農用地区域内農地", "甲種農地", "第1種農地", "第2種農地", "第3種農地"];

/**
 * 農地転用許可のインテイクフォームのHTMLページを返す。
 * @param {{ error?: string }} [options]
 * @returns {string}
 */
export function renderNouchiTenyoFormPage(options = {}) {
  const errorBlock = options.error
    ? `<div class="error">入力内容の処理中にエラーが発生しました: ${escapeHtml(options.error)}</div>`
    : "";

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>kensetsu-kyoka-toolkit — 農地転用許可 申請者情報インテイク</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <h1>農地転用許可 申請者情報インテイク</h1>
  <p class="notice">
    ※ この画面の判定結果は「申請前の一次スクリーニング」に過ぎません。
    農地区分の最終認定・許可可否の最終判断は農業委員会・都道府県が行います。
    最終的な適格性の判断・書類の内容確認・提出は必ず登録行政書士本人が行ってください。
    実在の顧客情報を入力する場合、このツールはローカルでのみ動作し外部へは送信しません。
  </p>
  <p><a href="/">← 建設業許可のインテイクフォームへ戻る</a></p>
</header>
${errorBlock}
<main>
<form id="nouchiTenyoForm" method="POST" action="/nouchi-tenyo/submit">
  <input type="hidden" name="profileJson" id="profileJson">

  <section>
    <h2>1. 基本情報</h2>
    <label>適用条文
      <select id="article">
        <option value="4条">4条（自己転用）</option>
        <option value="5条">5条（権利移動を伴う転用）</option>
      </select>
    </label>
    <label>申請者氏名または法人名 <input type="text" id="applicantName" required></label>
    <label>住所 <input type="text" id="address"></label>
    <label>転用対象農地の所在地（地番） <input type="text" id="landAddress"></label>
    <label>転用対象農地の面積（平方メートル） <input type="number" id="landAreaSqm" min="0" step="1"></label>
    <label>転用の目的（例: 資材置場、駐車場） <input type="text" id="purposeOfConversion"></label>
    <label>譲受人・借主氏名（5条許可の場合のみ） <input type="text" id="rightsHolderName"></label>
  </section>

  <section>
    <h2>2. 立地基準（農地区分。農地委員会への事前相談等で確認した内容）</h2>
    <label>農地区分
      <select id="nouchiKubun">
        ${NOUCHI_KUBUN_OPTIONS.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("\n        ")}
      </select>
    </label>
    <label class="inline"><input type="checkbox" id="hasExceptionReason"> 原則不許可の区分（農用地区域内農地・甲種農地・第1種農地）に該当する場合、例外規定に該当する事情がある</label>
    <label>例外事由の具体的な内容（自由記述。任意） <textarea id="exceptionReasonNote" rows="2"></textarea></label>
    <label class="inline"><input type="checkbox" id="hasNoAlternativeLand"> 第2種農地の場合、周辺の他の土地で代替可能な土地が無い</label>
  </section>

  <section>
    <h2>3. 一般基準（転用の確実性・周辺農地への配慮）</h2>
    <label class="inline"><input type="checkbox" id="hasSufficientFundsAndCredit"> 転用を確実に行うための資力・信用が確認できる（融資内諾書・自己資金証明等）</label>
    <label class="inline"><input type="checkbox" id="hasConstructionSchedule"> 工事計画・工程表が具体的に定まっている</label>
    <label class="inline"><input type="checkbox" id="hasNeighborDamagePreventionMeasures"> 周辺農地への被害防除措置（排水計画等）が講じられている</label>
    <label class="inline"><input type="checkbox" id="hasNeighborConsent"> 隣接農地所有者等の同意を得ている（任意）</label>
  </section>

  <section>
    <h2>4. 資金調達内訳（事業計画書用。任意）</h2>
    <div id="shikinChotatsuContainer"></div>
    <button type="button" id="addShikinChotatsuBtn">＋ 資金調達区分を追加</button>
  </section>

  <div class="actions">
    <button type="submit" class="primary">要件判定＋書類サマリーを生成する</button>
  </div>
</form>
</main>

<template id="shikinChotatsuRowTemplate">
  <fieldset class="row shikinChotatsu-row">
    <legend>資金調達区分</legend>
    <label>区分（例: 自己資金、金融機関借入） <input type="text" class="shikinChotatsu-kubun"></label>
    <label>金額（円） <input type="number" class="shikinChotatsu-amountYen" min="0" step="1"></label>
    <label>備考（任意） <input type="text" class="shikinChotatsu-note"></label>
    <button type="button" class="removeRowBtn">削除</button>
  </fieldset>
</template>

<script>
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
  section { border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
  section h2 { margin-top: 0; font-size: 1.05em; }
  label { display: block; margin: 8px 0; }
  label.inline { display: block; }
  input[type=text], input[type=number], select, textarea { width: 100%; max-width: 420px; box-sizing: border-box; padding: 4px 6px; }
  .row { border: 1px dashed #bbb; border-radius: 4px; padding: 8px; margin: 8px 0; }
  .row input[type=text], .row input[type=number] { width: auto; }
  button { cursor: pointer; }
  .actions { display: flex; gap: 10px; align-items: center; margin-top: 8px; }
  button.primary { font-size: 1.05em; padding: 10px 20px; }
  .removeRowBtn { color: #a33; margin-top: 8px; }
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

document.getElementById("addShikinChotatsuBtn").addEventListener("click", () => addRow("shikinChotatsuContainer", "shikinChotatsuRowTemplate"));

function collectShikinChotatsu() {
  return Array.from(document.querySelectorAll("#shikinChotatsuContainer .shikinChotatsu-row"))
    .map((row) => {
      const kubun = row.querySelector(".shikinChotatsu-kubun").value;
      const amountYenRaw = row.querySelector(".shikinChotatsu-amountYen").value;
      const note = row.querySelector(".shikinChotatsu-note").value;
      if (!kubun && !amountYenRaw) return null;
      return {
        kubun,
        amountYen: amountYenRaw ? Number(amountYenRaw) : 0,
        note: note || undefined,
      };
    })
    .filter((item) => item !== null);
}

function buildProfile() {
  const str = (id) => document.getElementById(id).value || undefined;
  const num = (id) => (document.getElementById(id).value ? Number(document.getElementById(id).value) : undefined);
  const checked = (id) => document.getElementById(id).checked;

  const shikinChotatsu = collectShikinChotatsu();

  return {
    article: document.getElementById("article").value,
    applicantName: document.getElementById("applicantName").value,
    address: str("address"),
    landAddress: str("landAddress"),
    landAreaSqm: num("landAreaSqm"),
    purposeOfConversion: str("purposeOfConversion"),
    rightsHolderName: str("rightsHolderName"),
    ricchiKijun: {
      nouchiKubun: document.getElementById("nouchiKubun").value,
      hasExceptionReason: checked("hasExceptionReason"),
      exceptionReasonNote: str("exceptionReasonNote"),
      hasNoAlternativeLand: checked("hasNoAlternativeLand"),
    },
    ippanKijun: {
      hasSufficientFundsAndCredit: checked("hasSufficientFundsAndCredit"),
      hasConstructionSchedule: checked("hasConstructionSchedule"),
      hasNeighborDamagePreventionMeasures: checked("hasNeighborDamagePreventionMeasures"),
      hasNeighborConsent: checked("hasNeighborConsent"),
    },
    shikinChotatsu: shikinChotatsu.length > 0 ? shikinChotatsu : undefined,
  };
}

document.getElementById("nouchiTenyoForm").addEventListener("submit", () => {
  document.getElementById("profileJson").value = JSON.stringify(buildProfile());
});
`;
