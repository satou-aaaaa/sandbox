/**
 * Webフォーム（M3）で使う最小限のHTMLエスケープ処理。
 * テンプレートエンジンやフロントエンドフレームワークは導入せず、
 * プレーンな文字列テンプレートでHTMLを組み立てる方針（NFR-1のビルドレス構成に合わせる）。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
