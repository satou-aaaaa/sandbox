/**
 * scripts/lib/aggregateChangelog.mjs のユニットテスト（Issue #230）。
 * ファイルI/Oは行わず、文字列処理のみを検証する（CLI自体の挙動は手動確認）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateChangelog,
  compareFragmentNames,
  defaultSectionHeading,
  insertFragmentsIntoChangelog,
  isFragmentFile,
  prepareFragments,
  splitSections,
} from "../scripts/lib/aggregateChangelog.mjs";

test("isFragmentFile: .md のみ対象、_ や . で始まるものは除外", () => {
  assert.equal(isFragmentFile("230.md"), true);
  assert.equal(isFragmentFile("230-2.md"), true);
  assert.equal(isFragmentFile("_TEMPLATE.md"), false);
  assert.equal(isFragmentFile(".gitkeep"), false);
  assert.equal(isFragmentFile("230.md.bak"), false);
  assert.equal(isFragmentFile("README.txt"), false);
});

test("compareFragmentNames: 数値部分を数値として比較する自然順ソート", () => {
  const names = ["86-2.md", "9.md", "10.md", "86.md"];
  assert.deepEqual([...names].sort(compareFragmentNames), ["9.md", "10.md", "86-2.md", "86.md"]);
});

test("prepareFragments: 順序を保ち、空ファイルと重複内容をスキップする", () => {
  const { items, emptySkipped, duplicateSkipped } = prepareFragments([
    { name: "10.md", content: "- Bの変更\n" },
    { name: "2.md", content: "- Aの変更\n" },
    { name: "3.md", content: "   \n\n" }, // 空白のみ＝空ファイル扱い
    { name: "11.md", content: "- Aの変更\n" }, // 2.md と内容が重複
  ]);
  assert.deepEqual(items.map((i) => i.name), ["2.md", "10.md"]);
  assert.deepEqual(items.map((i) => i.body), ["- Aの変更", "- Bの変更"]);
  assert.deepEqual(emptySkipped, ["3.md"]);
  assert.deepEqual(duplicateSkipped, ["11.md"]);
});

test("prepareFragments: 空配列なら全て空", () => {
  assert.deepEqual(prepareFragments([]), { items: [], emptySkipped: [], duplicateSkipped: [] });
});

test("splitSections: 前文と節に分ける", () => {
  const text = "# タイトル\n\n前文。\n\n## A\n\n本文A\n\n## B\n\n本文B\n";
  const { preamble, sections } = splitSections(text);
  assert.equal(preamble, "# タイトル\n\n前文。\n\n");
  assert.deepEqual(sections, ["## A\n\n本文A\n\n", "## B\n\n本文B\n"]);
});

test("splitSections: 見出しが無ければ全体を前文として返す", () => {
  const { preamble, sections } = splitSections("ただの文章\n");
  assert.equal(preamble, "ただの文章\n");
  assert.deepEqual(sections, []);
});

test("insertFragmentsIntoChangelog: 見出しが新規なら先頭の節として挿入する", () => {
  const before = "# タイトル\n\n前文。\n\n## 既存の節\n\n既存の本文\n";
  const after = insertFragmentsIntoChangelog(before, "## 新しい節（2026年10月）", [{ name: "1.md", body: "- 変更A" }]);
  assert.equal(after, "# タイトル\n\n前文。\n\n## 新しい節（2026年10月）\n\n- 変更A\n\n## 既存の節\n\n既存の本文\n");
});

test("insertFragmentsIntoChangelog: 複数断片は結合して1つの節本文にする", () => {
  const before = "# タイトル\n\n前文。\n\n## 既存の節\n\n既存の本文\n";
  const after = insertFragmentsIntoChangelog(before, "## 新しい節", [
    { name: "1.md", body: "- 変更A" },
    { name: "2.md", body: "- 変更B" },
  ]);
  assert.equal(after, "# タイトル\n\n前文。\n\n## 新しい節\n\n- 変更A\n\n- 変更B\n\n## 既存の節\n\n既存の本文\n");
});

test("insertFragmentsIntoChangelog: 見出しが既存ならその節の末尾に追記する（既存本文は壊さない）", () => {
  const before = "# タイトル\n\n前文。\n\n## 既存の節\n\n既存の本文\n\n## さらに前の節\n\nさらに前の本文\n";
  const after = insertFragmentsIntoChangelog(before, "## 既存の節", [{ name: "1.md", body: "- 追記される変更" }]);
  assert.equal(after, "# タイトル\n\n前文。\n\n## 既存の節\n\n既存の本文\n\n- 追記される変更\n\n## さらに前の節\n\nさらに前の本文\n");
});

test("insertFragmentsIntoChangelog: 断片が0件なら入力をそのまま返す", () => {
  const before = "# タイトル\n\n## 既存の節\n\n本文\n";
  assert.equal(insertFragmentsIntoChangelog(before, "## 新しい節", []), before);
});

test("insertFragmentsIntoChangelog: 既存セクションが無い（節が1つも無い）ファイルにも挿入できる", () => {
  const before = "# タイトル\n\n前文のみで節が無い。\n";
  const after = insertFragmentsIntoChangelog(before, "## 最初の節", [{ name: "1.md", body: "- 変更A" }]);
  assert.equal(after, "# タイトル\n\n前文のみで節が無い。\n## 最初の節\n\n- 変更A\n\n");
});

test("aggregateChangelog: 読み込み〜整理〜挿入までを1回で行う", () => {
  const before = "# タイトル\n\n前文。\n\n## 既存の節\n\n既存の本文\n";
  const { content, items, emptySkipped, duplicateSkipped } = aggregateChangelog(before, "## 新しい節", [
    { name: "2.md", content: "- 変更B\n" },
    { name: "1.md", content: "- 変更A\n" },
    { name: "3.md", content: "\n" },
  ]);
  assert.match(content, /## 新しい節\n\n- 変更A\n\n- 変更B\n\n## 既存の節/);
  assert.deepEqual(items.map((i) => i.name), ["1.md", "2.md"]);
  assert.deepEqual(emptySkipped, ["3.md"]);
  assert.deepEqual(duplicateSkipped, []);
});

test("defaultSectionHeading: 年月を含む見出しを作る", () => {
  assert.equal(defaultSectionHeading(new Date(2026, 9, 4)), "## 変更履歴断片の集約（2026年10月）");
});

test("並行する2つのPRの断片は、別ファイルである限り衝突せずどちらも集約される", () => {
  // PR #100 と PR #101 が同時に changelog.d/ へ断片を追加しても、
  // ファイル名が異なる限りgit上でもconflictせず、集約時にはどちらも反映される
  // （設計の核。CHANGELOG.md本体を同時に編集する従来方式との違いを示す）。
  const before = "# タイトル\n\n前文。\n";
  const { content, items } = aggregateChangelog(before, "## 今回の集約", [
    { name: "100.md", content: "- PR#100の変更\n" },
    { name: "101.md", content: "- PR#101の変更\n" },
  ]);
  assert.deepEqual(items.map((i) => i.name), ["100.md", "101.md"]);
  assert.match(content, /- PR#100の変更\n\n- PR#101の変更/);
});
