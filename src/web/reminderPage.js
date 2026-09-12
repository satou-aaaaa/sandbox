/**
 * data/clients.json に登録済みのクライアントについて、
 * リマインド・ダイジェストをブラウザで確認できる画面（読み取り専用）。
 *
 * クライアントの登録・削除はCLI（scripts/add-client.js / remove-client.js）で
 * 行う運用を想定している。この画面自体はフォームを持たない
 * （案件登録は許可日確定後の別工程であり、インテイクフォームとはライフサイクルが
 * 異なるため、意図的にワークフローを混在させていない）。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * @param {{ report: string, clientCount: number }} params
 * @returns {string}
 */
export function renderReminderPage({ report, clientCount }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>リマインド・ダイジェスト — kensetsu-kyoka-toolkit</title>
<style>${STYLE}</style>
</head>
<body>
<h1>更新リマインド・ダイジェスト</h1>
<p class="notice">
  登録クライアント数: ${clientCount}件。クライアントの登録・削除はCLI
  （<code>node scripts/add-client.js</code> / <code>node scripts/remove-client.js</code>）で行ってください。
  この画面は表示専用です。
</p>
<pre>${escapeHtml(report)}</pre>
<p><a href="/">← 申請者情報インテイクに戻る</a></p>
</body>
</html>`;
}

const STYLE = `
  body { font-family: "Yu Gothic", sans-serif; max-width: 820px; margin: 0 auto; padding: 16px 20px 60px; line-height: 1.6; }
  .notice { background: #FFF4E5; border: 1px solid #E0A030; padding: 10px 14px; font-size: 0.9em; }
  pre { white-space: pre-wrap; background: #f7f7f7; border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
  code { background: #eee; padding: 1px 4px; border-radius: 3px; }
`;
