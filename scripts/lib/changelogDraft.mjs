/**
 * コミット件名の一覧から、CHANGELOG.md 用の下書き（Markdown）を作る純粋関数。
 * 下書きは人が読んで編集する前提（本ファイルは分類と整形だけを行い、文面の良し悪しは判断しない）。
 */

/** 接頭辞 → 見出し。表示順もこの並び。 */
const CATEGORIES = [
  ["feat", "機能追加"],
  ["fix", "不具合修正"],
  ["security", "セキュリティ"],
  ["test", "テスト"],
  ["docs", "ドキュメント"],
  ["chore", "保守・運用"],
  ["refactor", "リファクタリング"],
  ["other", "その他"],
];

/**
 * @param {string} subject コミット件名（例: `feat: 〇〇を追加する (#158)`）
 * @returns {{category: string, text: string, pr: string | null}}
 */
export function parseSubject(subject) {
  const trimmed = subject.trim();
  const m = trimmed.match(/^([a-z]+)(?:\([^)]*\))?!?:\s*(.+)$/);
  const known = new Set(CATEGORIES.map(([k]) => k));
  const category = m && known.has(m[1]) ? m[1] : "other";
  let text = m && known.has(m[1]) ? m[2] : trimmed;
  // 末尾の (#123) は、PR番号として取り出す（重複して付いていたら最後の1つを採用）
  const prs = [...text.matchAll(/\s*\(#(\d+)\)/g)];
  const pr = prs.length > 0 ? prs[prs.length - 1][1] : null;
  text = text.replace(/\s*\(#\d+\)/g, "").trim();
  return { category, text, pr };
}

/**
 * @param {string[]} subjects コミット件名（新しい順でも古い順でもよい）
 * @param {{title: string, repo?: string}} options 見出しと、PRリンクを作るための `owner/repo`
 * @returns {string} Markdown（マージコミット・依存更新bot・自動レポート系は除外）
 */
export function buildChangelogDraft(subjects, { title, repo }) {
  const skip = /^(Merge |Revert ")|^(chore|build)\(deps(-dev)?\)|^Bump /;
  /** @type {Map<string, string[]>} */
  const groups = new Map(CATEGORIES.map(([k]) => [k, []]));
  const seen = new Set();
  for (const s of subjects) {
    if (!s.trim() || skip.test(s.trim())) continue;
    const { category, text, pr } = parseSubject(s);
    const key = `${category}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const link = pr ? (repo ? ` ([#${pr}](https://github.com/${repo}/pull/${pr}))` : ` (#${pr})`) : "";
    groups.get(category)?.push(`- ${text}${link}`);
  }
  const lines = [`## ${title}`, "", "<!-- 自動生成の下書き。マイルストーン単位に要約して、人が編集してから CHANGELOG.md に取り込む -->", ""];
  for (const [key, heading] of CATEGORIES) {
    const items = groups.get(key) ?? [];
    if (items.length === 0) continue;
    lines.push(`### ${heading}`, "", ...items, "");
  }
  if (lines.length === 4) lines.push("（対象期間に変更はありません）", "");
  return lines.join("\n");
}
