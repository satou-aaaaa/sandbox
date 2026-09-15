/**
 * 保存済みの下書き（インテイクフォームの入力途中データ）一覧画面。
 * 「続きから入力」でフォームへ戻る、「削除」で不要な下書きを消す、の2操作のみ。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * @param {{ drafts: import('./draftStore.js').DraftRecord[] }} params
 * @returns {string}
 */
export function renderDraftsPage({ drafts }) {
  const rows =
    drafts.length === 0
      ? `<p>保存済みの下書きはありません。</p>`
      : `<table>
    <thead><tr><th>申請者名</th><th>保存日時</th><th>入力再開</th><th>削除</th></tr></thead>
    <tbody>
    ${drafts
      .map(
        (d) => `<tr>
        <td>${escapeHtml(d.profile?.applicantName || "（名称未設定）")}</td>
        <td>${escapeHtml(new Date(d.savedAt).toLocaleString("ja-JP"))}</td>
        <td><a href="/drafts/${encodeURIComponent(d.id)}">続きから入力</a></td>
        <td>
          <form method="POST" action="/drafts/${encodeURIComponent(d.id)}/delete" onsubmit="return confirm('この下書きを削除しますか？');">
            <button type="submit" class="danger">削除</button>
          </form>
        </td>
      </tr>`
      )
      .join("\n")}
    </tbody>
  </table>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>下書き一覧 — kensetsu-kyoka-toolkit</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>保存済みの下書き</h1>
${rows}
<p><a href="/">← 新規に申請者情報を入力する</a></p>
</main>
</body>
</html>`;
}

const STYLE = `
  body { font-family: "Yu Gothic", sans-serif; max-width: 820px; margin: 0 auto; padding: 16px 20px 60px; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
  form { display: inline; margin: 0; }
  button.danger { color: #a33; background: none; border: 1px solid #a33; border-radius: 4px; padding: 2px 8px; cursor: pointer; }
`;
