/**
 * Stryker の JSON レポート（mutation-testing-elements 形式）から、生き残ったミュータントの要約を作る純粋関数。
 * 生き残り＝そのコード変更をテストが検知できなかった箇所で、assert の不足を示す手がかり（stryker.config.mjs 参照）。
 */

/**
 * @typedef {Object} Mutant
 * @property {string} mutatorName
 * @property {string} status Killed | Survived | NoCoverage | Timeout | CompileError | RuntimeError | Ignored
 * @property {{start: {line: number}}} location
 * @property {string} [replacement]
 *
 * @typedef {{files: Record<string, {mutants: Mutant[]}>}} MutationReport
 */

/**
 * @param {MutationReport} report
 * @param {{maxLines?: number}} [options] 生き残りの詳細を載せる最大行数
 * @returns {{score: number | null, total: number, killed: number, survived: number, noCoverage: number, markdown: string}}
 */
export function summarizeMutation(report, { maxLines = 40 } = {}) {
  let killed = 0;
  let survived = 0;
  let noCoverage = 0;
  /** @type {{file: string, line: number, mutator: string, replacement: string, status: string}[]} */
  const survivors = [];
  for (const [file, data] of Object.entries(report.files ?? {})) {
    for (const m of data.mutants ?? []) {
      if (m.status === "Killed" || m.status === "Timeout") killed += 1;
      else if (m.status === "Survived" || m.status === "NoCoverage") {
        if (m.status === "Survived") survived += 1;
        else noCoverage += 1;
        survivors.push({ file, line: m.location?.start?.line ?? 0, mutator: m.mutatorName, replacement: (m.replacement ?? "").replace(/\s+/g, " ").slice(0, 60), status: m.status });
      }
    }
  }
  const total = killed + survived + noCoverage;
  const score = total === 0 ? null : Math.round((killed / total) * 1000) / 10;

  /** @type {Map<string, number>} */
  const perFile = new Map();
  for (const s of survivors) perFile.set(s.file, (perFile.get(s.file) ?? 0) + 1);
  const ranked = [...perFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const lines = ["# ミューテーションテスト結果", ""];
  lines.push(score === null ? "対象のミュータントがありません。" : `スコア **${score}%**（検知 ${killed} / 全 ${total}。生き残り ${survived}、テスト未到達 ${noCoverage}）`, "");
  if (ranked.length > 0) {
    lines.push("## 生き残りが多いファイル", "", "| ファイル | 生き残り数 |", "|---|---|", ...ranked.slice(0, 15).map(([f, n]) => `| \`${f}\` | ${n} |`), "");
    lines.push(`## 生き残りの例（先頭${Math.min(maxLines, survivors.length)}件）`, "");
    const sorted = [...survivors].sort((a, b) => (perFile.get(b.file) ?? 0) - (perFile.get(a.file) ?? 0) || a.file.localeCompare(b.file) || a.line - b.line);
    for (const s of sorted.slice(0, maxLines)) lines.push(`- \`${s.file}:${s.line}\` ${s.mutator}${s.replacement ? ` → \`${s.replacement}\`` : ""}${s.status === "NoCoverage" ? "（テスト未到達）" : ""}`);
    lines.push("");
  }
  lines.push("詳細なHTMLレポートは、ローカルで `npm run test:mutation` を実行すると `reports/mutation/mutation.html` に出力されます。", "スコアの閾値による自動失敗はしていません（実測値がたまるまで、傾向を見るだけ。ADR-0018）。", "");
  return { score, total, killed, survived, noCoverage, markdown: lines.join("\n") };
}
