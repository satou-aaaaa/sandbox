/**
 * changelog.d/*.md の断片（1ファイル=1件のCHANGELOG記載）を CHANGELOG.md の
 * 指定セクションへ集約する純粋関数群（Issue #230）。
 *
 * 背景: CHANGELOG.md は冒頭に新しい記載を追記する運用のため、複数PR（人・
 * 運用エージェント・別セッション）が同時に冒頭へ追記すると衝突しやすい
 * （PR #86で2回手動解消した経緯がある）。各PRは `changelog.d/<PR番号>.md` に
 * 断片を1件書き、マイルストーン等の区切りで `scripts/aggregate-changelog.mjs`
 * （本ファイルを使うCLI）がまとめて `CHANGELOG.md` へ反映し、取り込んだ断片を削除する。
 *
 * ファイルI/O・CLI引数の処理は呼び出し側（scripts/aggregate-changelog.mjs）が行う。
 * 本ファイルは文字列処理だけの純粋関数のみを置く。
 */

/**
 * 断片として集約対象にするファイル名か判定する。
 * `_` または `.` で始まるファイル（雛形 `_TEMPLATE.md` 等）は対象外。
 * @param {string} filename
 * @returns {boolean}
 */
export function isFragmentFile(filename) {
  return filename.endsWith(".md") && !filename.startsWith("_") && !filename.startsWith(".");
}

/**
 * ファイル名を自然順（数値部分は数値として）で比較する。
 * 例: "9.md" < "10.md" < "86-2.md"
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareFragmentNames(a, b) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/**
 * @typedef {{name: string, content: string}} RawFragment 読み込んだ断片ファイル（ファイル名＋生の内容）
 * @typedef {{name: string, body: string}} PreparedFragment 空・重複を除いた断片（内容は前後空白を除去済み）
 */

/**
 * 断片の一覧から、空ファイル・内容が重複するものを除いた本文一覧を作る。
 * ファイル名の自然順でソートしてから処理するため、重複時は先に出てくる
 * （番号の小さい・古い）ファイルを残し、後発を「重複のためスキップ」とする。
 * 不正・欠落データで止めず、スキップして処理を続ける方針（CLAUDE.md）に従う。
 * @param {RawFragment[]} rawFragments
 * @returns {{items: PreparedFragment[], emptySkipped: string[], duplicateSkipped: string[]}}
 */
export function prepareFragments(rawFragments) {
  const sorted = [...rawFragments].sort((a, b) => compareFragmentNames(a.name, b.name));
  /** @type {PreparedFragment[]} */
  const items = [];
  /** @type {string[]} */
  const emptySkipped = [];
  /** @type {string[]} */
  const duplicateSkipped = [];
  const seenBodies = new Set();
  for (const { name, content } of sorted) {
    const body = content.trim();
    if (body === "") {
      emptySkipped.push(name);
      continue;
    }
    if (seenBodies.has(body)) {
      duplicateSkipped.push(name);
      continue;
    }
    seenBodies.add(body);
    items.push({ name, body });
  }
  return { items, emptySkipped, duplicateSkipped };
}

/**
 * CHANGELOG.md の本文を、先頭の "## " 見出し行を境に「前文」と「節（セクション）」の
 * 配列へ分ける。各節は自身の見出し行から次の見出し行の直前まで（末尾の空行を含む）。
 * @param {string} changelogText
 * @returns {{preamble: string, sections: string[]}}
 */
export function splitSections(changelogText) {
  const idx = changelogText.search(/^## /m);
  if (idx === -1) return { preamble: changelogText, sections: [] };
  const sections = changelogText.slice(idx).split(/(?=^## )/m);
  return { preamble: changelogText.slice(0, idx), sections };
}

/**
 * 断片本文（`PreparedFragment[]`）を1つの節本文へ結合する（空行1つで区切る）。
 * @param {PreparedFragment[]} items
 * @returns {string}
 */
function joinBodies(items) {
  return items.map((i) => i.body).join("\n\n");
}

/**
 * 断片を CHANGELOG.md の指定セクション見出しの下へ集約する。
 * - 見出しが既存の節に無ければ、新しい節（見出し＋本文）を一番新しい位置
 *   （先頭の既存セクションの直前＝前文の直後）に挿入する。
 * - 見出しが既存の節にあれば、その節の末尾に追記する（同一サイクル内で
 *   複数回実行しても取り込み済みの内容を壊さない）。
 * 断片が0件なら何もしない（入力をそのまま返す）。
 * @param {string} changelogText CHANGELOG.md の現在の内容
 * @param {string} sectionHeading 例: "## 見出し（2026年10月・#230）"
 * @param {PreparedFragment[]} items prepareFragments() の items
 * @returns {string} 更新後の CHANGELOG.md の内容
 */
export function insertFragmentsIntoChangelog(changelogText, sectionHeading, items) {
  if (items.length === 0) return changelogText;
  const heading = sectionHeading.trim();
  const combinedBody = joinBodies(items);
  const { preamble, sections } = splitSections(changelogText);

  const existingIndex = sections.findIndex((s) => s.split("\n", 1)[0].trim() === heading);

  if (existingIndex === -1) {
    const newSection = `${heading}\n\n${combinedBody}\n\n`;
    return preamble + [newSection, ...sections].join("");
  }

  // existingIndex は sections（配列）に対する findIndex の結果であり、0以上
  // sections.length未満の数値インデックスにしかならない（外部入力がプロパティ名として
  // 使われることはない）。
  // eslint-disable-next-line security/detect-object-injection
  const existing = sections[existingIndex];
  const updated = `${existing.replace(/\n+$/, "")}\n\n${combinedBody}\n\n`;
  const nextSections = [...sections];
  // eslint-disable-next-line security/detect-object-injection
  nextSections[existingIndex] = updated;
  return preamble + nextSections.join("");
}

/**
 * 断片の読み込み〜整理〜CHANGELOG.md への挿入までを1回で行う（CLIから呼ぶ想定）。
 * @param {string} changelogText CHANGELOG.md の現在の内容
 * @param {string} sectionHeading
 * @param {RawFragment[]} rawFragments
 * @returns {{content: string, items: PreparedFragment[], emptySkipped: string[], duplicateSkipped: string[]}}
 */
export function aggregateChangelog(changelogText, sectionHeading, rawFragments) {
  const { items, emptySkipped, duplicateSkipped } = prepareFragments(rawFragments);
  const content = insertFragmentsIntoChangelog(changelogText, sectionHeading, items);
  return { content, items, emptySkipped, duplicateSkipped };
}

/**
 * 既定のセクション見出しを今日の日付から作る（`--section` 省略時のフォールバック）。
 * @param {Date} [now]
 * @returns {string}
 */
export function defaultSectionHeading(now = new Date()) {
  return `## 変更履歴断片の集約（${now.getFullYear()}年${now.getMonth() + 1}月）`;
}
