/**
 * 法令・様式改正ウォッチャーの純粋関数群（取得・比較・報告の整形。通信は scripts/law-watch.mjs 側）。
 *
 * ソースコードの冒頭コメントに書いた根拠URLの内容が変わっていないかを、保存済みの基準線
 * （docs/law-watch-baseline.json）と比べて検知する。取得するのは公開ページだけで、個人情報は扱わない。
 * 変化の検知は「人が原文を見直すきっかけ」であり、ロジックの自動修正はしない。
 */
import { createHash } from "node:crypto";

/**
 * @typedef {Object} Snapshot 取得結果の要約（基準線に保存する形）
 * @property {"egov" | "html"} kind
 * @property {string} title タイトル（法令名・ページtitle）
 * @property {string} hash 本文（正規化後）のSHA-256
 * @property {string} [revisionId] e-Gov: 現行の法令履歴ID
 * @property {string | null} [enforcementDate] e-Gov: 現行版の施行日
 * @property {string | null} [scheduledDate] e-Gov: 施行予定の改正があればその施行日
 * @property {number} [chars] html: 正規化後の文字数
 *
 * @typedef {{ok: true, snapshot: Snapshot} | {ok: false, error: string}} FetchResult
 */

/**
 * e-Gov法令検索のURLから法令ID（例: 324AC0000000108）を取り出す。
 * @param {string} url
 * @returns {string | null}
 */
export function egovLawId(url) {
  const m = url.match(/^https:\/\/laws\.e-gov\.go\.jp\/law\/([0-9A-Za-z]+)/);
  return m ? m[1] : null;
}

/**
 * @param {string} text
 * @returns {string} SHA-256（16進）
 */
export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * HTMLを本文テキストへ正規化する（スクリプト・スタイル・タグ・空白の揺れを除く）。
 * @param {string} html
 * @returns {{title: string, text: string}}
 */
export function normalizeHtml(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // &amp; は最後に戻す（先に戻すと &amp;lt; が二重にアンエスケープされて < になるため）
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

/**
 * @param {string} html
 * @returns {Snapshot}
 */
export function snapshotHtml(html) {
  const { title, text } = normalizeHtml(html);
  return { kind: "html", title, hash: sha256(text), chars: text.length };
}

/**
 * e-Gov法令API v2（law_data）のJSONから要約を作る。
 * @param {any} json
 * @returns {Snapshot}
 */
export function snapshotEgov(json) {
  const rev = json?.revision_info ?? {};
  return {
    kind: "egov",
    title: String(rev.law_title ?? json?.law_info?.law_num ?? ""),
    revisionId: String(rev.law_revision_id ?? ""),
    enforcementDate: rev.amendment_enforcement_date ?? null,
    scheduledDate: rev.amendment_scheduled_enforcement_date ?? null,
    hash: sha256(JSON.stringify(json?.law_full_text ?? null)),
  };
}

/**
 * 基準線と現在の取得結果の差を、人が読める文にする。差が無ければ空配列。
 * @param {Snapshot} before
 * @param {Snapshot} now
 * @returns {string[]}
 */
export function describeChange(before, now) {
  /** @type {string[]} */
  const out = [];
  if (before.kind !== now.kind) return [`取得方法が変わりました（${before.kind} → ${now.kind}）`];
  if (now.kind === "egov") {
    if (before.revisionId !== now.revisionId) out.push(`法令の版が更新されました（${before.revisionId} → ${now.revisionId}、施行日 ${before.enforcementDate ?? "不明"} → ${now.enforcementDate ?? "不明"}）`);
    if (before.scheduledDate !== now.scheduledDate && now.scheduledDate) out.push(`施行予定の改正があります（施行予定日 ${now.scheduledDate}）`);
    if (before.hash !== now.hash && out.length === 0) out.push("条文の内容が変わりました（版のIDは同じ）");
  } else if (before.hash !== now.hash) {
    out.push(`ページ本文が変わりました（${before.chars ?? "?"}字 → ${now.chars ?? "?"}字）。軽微な表記・お知らせ欄の更新の可能性もあります`);
  }
  return out;
}

/**
 * 根拠URLを挙げているファイルから、見直しの対象になる設計書・要件定義書を割り出す（決定論的。LLMは使わない。ADR-0019）。
 * 対応: src/licenses/<名前>/ → docs/DESIGN_<名前>-core.md、src/incorporation → kaisha-secchi-support、
 * src/succession → souzoku-support、src/portal → uketsuke-portal、それ以外（src/core・建設業許可）→ docs/DESIGN.md。
 * 実在しない候補は除く（存在確認は呼び出し側から渡す）。
 * @param {string[]} files 根拠URLを挙げているファイル（リポジトリルートからの相対パス）
 * @param {(relPath: string) => boolean} exists
 * @returns {string[]} 設計書・要件定義書のパス（重複なし・昇順）
 */
export function impactedDocs(files, exists) {
  /** @type {Set<string>} */
  const docs = new Set();
  for (const f of files) {
    // 検出器（safe-regex）の保守的なヒューリスティックによる警告。対象 f はリポジトリ内の
    // ファイルパス（ローカルのソース走査結果）で外部入力ではなく、量指定子もネストしていない
    // ため破局的バックトラックは起きない（巨大な文字列を与えた検証でも所要時間は0msだった）。
    // eslint-disable-next-line security/detect-unsafe-regex
    const m = /^src\/(licenses|incorporation|portal|succession|core)(?:\/([^/]+))?\//.exec(f);
    if (!m) continue;
    const [, area, name] = m;
    /** @type {string | null} */
    let stem = null;
    if (area === "licenses" && name && name !== "construction") stem = `${name}-core`;
    else if (area === "incorporation") stem = "kaisha-secchi-support";
    else if (area === "succession") stem = "souzoku-support";
    else if (area === "portal") stem = "uketsuke-portal";
    const candidates = stem ? [`docs/DESIGN_${stem}.md`, `docs/REQUIREMENTS_${stem}.md`] : ["docs/DESIGN.md", "docs/REQUIREMENTS.md"];
    for (const c of candidates) if (exists(c)) docs.add(c);
  }
  return [...docs].sort();
}

/**
 * @typedef {Object} WatchReport
 * @property {{url: string, files: string[], details: string[], docs?: string[]}[]} changed 内容が変わったもの（docs は見直し対象の設計書。compareWithBaseline の第4引数を渡したとき）
 * @property {{url: string, files: string[], error: string, neverFetched: boolean}[]} failed 取得できなかったもの
 * @property {{url: string, files: string[]}[]} added 基準線に無い新しいURL
 * @property {string[]} removed 基準線にあるが、もうどこからも参照されていないURL
 * @property {number} unchanged 変化なし
 */

/**
 * @param {Record<string, Snapshot>} baseline URL → 基準線の要約
 * @param {Map<string, string[]>} sources URL → そのURLを根拠に挙げているファイル
 * @param {Map<string, FetchResult>} results URL → 取得結果
 * @param {(relPath: string) => boolean} [exists] 渡すと、変化のあったURLごとに見直し対象の設計書（docs）を付ける
 * @returns {WatchReport}
 */
export function compareWithBaseline(baseline, sources, results, exists) {
  /** @type {WatchReport} */
  const report = { changed: [], failed: [], added: [], removed: [], unchanged: 0 };
  // baseline はURLをキーとするプレーンオブジェクト（呼び出し元・テストの契約上そのまま）。
  // 任意キーでのオブジェクトアクセスを避けるため、参照だけMapに詰め替える。
  const baselineMap = new Map(Object.entries(baseline));
  for (const [url, files] of sources) {
    const result = results.get(url);
    const before = baselineMap.get(url);
    if (!result || !result.ok) {
      report.failed.push({ url, files, error: result && !result.ok ? result.error : "未取得", neverFetched: !before });
      continue;
    }
    if (!before) {
      report.added.push({ url, files });
      continue;
    }
    const details = describeChange(before, result.snapshot);
    if (details.length > 0) report.changed.push(exists ? { url, files, details, docs: impactedDocs(files, exists) } : { url, files, details });
    else report.unchanged += 1;
  }
  report.removed = Object.keys(baseline).filter((u) => !sources.has(u));
  return report;
}

/**
 * 人の対応が必要か（内容の変化、または基準線のあるURLの取得失敗）。
 * 新規URL・参照されなくなったURLだけなら、基準線の更新だけで足りるため対応不要。
 * @param {WatchReport} report
 * @returns {boolean}
 */
export function needsAttention(report) {
  return report.changed.length > 0 || report.failed.some((f) => !f.neverFetched);
}

/**
 * @param {WatchReport} report
 * @param {string} today YYYY-MM-DD
 * @returns {string} Issue本文・ジョブサマリー用のMarkdown
 */
export function buildReportMarkdown(report, today) {
  const files = (fs) => fs.map((f) => `\`${f}\``).join("、");
  const lines = [`# 法令・様式の根拠URL 点検結果（${today}）`, ""];
  lines.push(`変化なし ${report.unchanged} 件／変化あり ${report.changed.length} 件／取得失敗 ${report.failed.length} 件／新規 ${report.added.length} 件／参照なし ${report.removed.length} 件`, "");
  if (report.changed.length > 0) {
    lines.push("## 内容が変わった可能性のある根拠URL（要確認）", "");
    for (const c of report.changed) {
      lines.push(`- ${c.url}`, ...c.details.map((d) => `  - ${d}`), `  - 該当するファイル: ${files(c.files)}`);
      if (c.docs && c.docs.length > 0) lines.push(`  - 見直し対象の設計書: ${files(c.docs)}`);
    }
    lines.push("");
  }
  if (report.failed.length > 0) {
    lines.push("## 取得できなかった根拠URL", "");
    for (const f of report.failed) lines.push(`- ${f.url}（${f.error}）— ${files(f.files)}`);
    lines.push("", "一時的な障害の可能性もあります。次回の点検でも続く場合は、URLの移転・廃止を疑ってください。", "");
  }
  if (report.added.length > 0) {
    lines.push("## 基準線にまだ無い根拠URL", "", ...report.added.map((a) => `- ${a.url} — ${files(a.files)}`), "");
  }
  if (report.removed.length > 0) {
    lines.push("## どのファイルからも参照されなくなったURL（基準線から削除してよい）", "", ...report.removed.map((u) => `- ${u}`), "");
  }
  lines.push(
    "## 対応の流れ",
    "",
    "1. 変化のあった根拠URLの原文・改正内容を、人が読んで確認する（このツールは検知だけで、ロジックは自動修正しない）",
    "2. 判定・期限計算ロジックの見直しが必要なら、該当ファイルと `docs/DESIGN_*.md` を直す（法令領域は人手承認）",
    "3. 確認が済んだら `node scripts/law-watch.mjs --update` で基準線（`docs/law-watch-baseline.json`）を更新してPRにする",
    "",
  );
  return lines.join("\n");
}
