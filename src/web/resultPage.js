/**
 * M3: インテイクフォーム送信後の結果画面。
 * 要件判定結果と、生成された書類サマリー（docx）のダウンロードリンクを表示する。
 */
import { escapeHtml } from "./htmlUtils.js";

/**
 * @param {Object} params
 * @param {import('../eligibility/types.js').ApplicantProfile} params.profile
 * @param {import('../eligibility/types.js').EligibilityResult} params.result
 * @param {string} params.report フォーマット済みテキストレポート（formatEligibilityReportの出力）
 * @param {{ label: string, filename: string }[]} params.files
 * @param {string} params.sessionId ダウンロードURLに使うセッションID
 * @returns {string}
 */
export function renderResultPage({ profile, result, report, files, sessionId }) {
  const fileRows = files
    .map(
      (f) =>
        `<li><a href="/download/${encodeURIComponent(sessionId)}/${encodeURIComponent(f.filename)}">${escapeHtml(
          f.label
        )}</a></li>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>判定結果 — ${escapeHtml(profile.applicantName || "kensetsu-kyoka-toolkit")}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>要件判定結果 — ${escapeHtml(profile.applicantName || "（未入力）")}</h1>
<p class="notice">
  ※ この結果は「申請前の一次スクリーニング」です。最終的な適格性の判断・書類内容の確認・
  提出は必ず登録行政書士本人が行ってください。生成されたdocxも正式提出様式ではなく、
  内容確認・下書き用のサマリーです。
</p>
<p class="badge ${result.eligible ? "ok" : "ng"}">
  総合判定: ${result.eligible ? "○ 5要件すべて充足（申請準備を進められます）" : "× 未充足の要件があります"}
</p>

<h2>判定レポート</h2>
<pre>${escapeHtml(report)}</pre>

<h2>生成された書類サマリー（docx）</h2>
<ul>
${fileRows}
</ul>

<p><a href="/">← 新しい申請者情報を入力する</a></p>
</body>
</html>`;
}

const STYLE = `
  body { font-family: "Yu Gothic", sans-serif; max-width: 820px; margin: 0 auto; padding: 16px 20px 60px; line-height: 1.6; }
  .notice { background: #FFF4E5; border: 1px solid #E0A030; padding: 10px 14px; font-size: 0.9em; }
  .badge { display: inline-block; padding: 8px 14px; border-radius: 6px; font-weight: bold; }
  .badge.ok { background: #E7F6EC; color: #1E7A34; border: 1px solid #1E7A34; }
  .badge.ng { background: #FDECEC; color: #A33; border: 1px solid #A33; }
  pre { white-space: pre-wrap; background: #f7f7f7; border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
  ul { line-height: 1.9; }
`;
