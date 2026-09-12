/**
 * data/clients.json に登録済みのクライアントについて、
 * リマインド・ダイジェストをブラウザで確認できる画面（読み取り専用）。
 *
 * クライアントの登録・削除はCLI（scripts/add-client.js / remove-client.js）で
 * 行う運用を想定している。この画面自体はフォームを持たない
 * （案件登録は許可日確定後の別工程であり、インテイクフォームとはライフサイクルが
 * 異なるため、意図的にワークフローを混在させていない）。
 *
 * 「今すぐ確認すべき」リマインドで連絡先メールアドレスが登録されているものは、
 * メール下書きを開くリンクを表示する。あくまで下書きを開くだけで、
 * 送信の実行・最終判断は常に本人が行う（NFR-4: 外部送信をしない設計を維持）。
 *
 * 【M7: 一覧フィルタリング】画面上部に「すべて／期限超過／1ヶ月以内／…」の
 * 単純なリンク一覧を表示し、クリックで `/reminders?range=<key>` へ遷移する
 * ことで表示内容を絞り込む（`src/web/server.js` 側でフィルタ処理を行う）。
 * クライアント側JavaScriptは使わず、通常のGETリンクのみで実現している
 * （表示専用という既存の設計判断（§5.11）を踏襲。状態を持つUI部品は追加しない）。
 */
import { escapeHtml } from "./htmlUtils.js";
import { buildReminderMailtoUrl, REMINDER_RANGES } from "../reminders/reminderDigest.js";

/**
 * @param {{
 *   report: string,
 *   clientCount: number,
 *   actionableAlerts: import('../reminders/reminderDigest.js').ReminderAlert[],
 *   activeRange?: string | null
 * }} params
 * @returns {string}
 */
export function renderReminderPage({ report, clientCount, actionableAlerts, activeRange = null }) {
  const filterNav = renderFilterNav(activeRange);
  const mailtoItems = (actionableAlerts || [])
    .map((alert) => ({ alert, mailtoUrl: buildReminderMailtoUrl(alert) }))
    .filter((item) => item.mailtoUrl);

  const mailtoSection =
    mailtoItems.length > 0
      ? `<h2>連絡が必要な件（メール下書きを開く）</h2>
<ul>
${mailtoItems
  .map(({ alert, mailtoUrl }) => {
    // 1クライアントが複数許可を持つ場合、同じクライアント・同じ内容・同じ期限の
    // 項目が並びうるため、CLI向け出力（formatLine）・メール本文と同様に
    // どの許可分かをリンク文言にも明記する（M7・FR-5.4）。
    const licenseLabel = alert.licenseId ? `（許可: ${escapeHtml(alert.licenseId)}）` : "";
    return `<li><a href="${escapeHtml(mailtoUrl)}">${escapeHtml(alert.clientName)}${licenseLabel} — ${escapeHtml(
      alert.label
    )}（${escapeHtml(alert.dueDateIso)}）</a></li>`;
  })
  .join("\n")}
</ul>
<p class="notice">クリックすると既定のメールソフトで下書きが開きます。このツールがメールを送信することはありません。内容を確認してから送信してください。</p>`
      : "";

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>リマインド・ダイジェスト — kensetsu-kyoka-toolkit</title>
<style>${STYLE}</style>
</head>
<body>
<h1>更新リマインド・ダイジェスト</h1>
${filterNav}
<p class="notice">
  登録クライアント数: ${clientCount}件。クライアントの登録・削除はCLI
  （<code>node scripts/add-client.js</code> / <code>node scripts/remove-client.js</code>）で行ってください。
  この画面は表示専用です。
</p>
<p><a href="/clients.csv">→ クライアント一覧をCSVでダウンロード</a></p>
<pre>${escapeHtml(report)}</pre>
${mailtoSection}
<p><a href="/">← 申請者情報インテイクに戻る</a></p>
</body>
</html>`;
}

/**
 * 「すべて／期限超過／1ヶ月以内／…」の絞り込みリンク一覧を組み立てる。
 * 現在選択中の区分は `<strong>`（リンクなし）で表示し、それ以外は
 * `/reminders?range=<key>` へのリンクにする。「すべて」はクエリパラメータ
 * なしの `/reminders` へのリンク（`key: null`）。
 *
 * @param {string | null} activeRange
 * @returns {string}
 */
function renderFilterNav(activeRange) {
  const options = [{ key: null, label: "すべて" }, ...REMINDER_RANGES];
  const items = options.map(({ key, label }) => {
    const text = escapeHtml(label);
    if (key === activeRange) {
      return `<strong>${text}</strong>`;
    }
    const href = key ? `/reminders?range=${encodeURIComponent(key)}` : "/reminders";
    return `<a href="${escapeHtml(href)}">${text}</a>`;
  });
  return `<p class="filter-nav">表示する期間で絞り込み: ${items.join(" / ")}</p>`;
}

const STYLE = `
  body { font-family: "Yu Gothic", sans-serif; max-width: 820px; margin: 0 auto; padding: 16px 20px 60px; line-height: 1.6; }
  .notice { background: #FFF4E5; border: 1px solid #E0A030; padding: 10px 14px; font-size: 0.9em; }
  .filter-nav { font-size: 0.95em; }
  pre { white-space: pre-wrap; background: #f7f7f7; border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
  code { background: #eee; padding: 1px 4px; border-radius: 3px; }
  ul { line-height: 1.9; }
`;
