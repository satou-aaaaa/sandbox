import { test } from "node:test";
import assert from "node:assert/strict";
import { Paragraph, Table } from "docx";
import {
  orNotEntered,
  buildTitleHeading,
  buildSubHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildHeaderedTable,
  buildBulletList,
  NOT_ENTERED,
} from "../src/core/documents/common.js";

test("orNotEntered: 空文字列・null・undefinedは（未入力）になる", () => {
  assert.equal(orNotEntered(""), NOT_ENTERED);
  assert.equal(orNotEntered(null), NOT_ENTERED);
  assert.equal(orNotEntered(undefined), NOT_ENTERED);
});

test("orNotEntered: 通常の文字列はそのまま返す", () => {
  assert.equal(orNotEntered("テスト建設株式会社"), "テスト建設株式会社");
});

test("orNotEntered: 数値の0は「入力あり」ではなく（未入力）扱いになる（falsy判定の既知の挙動）", () => {
  // orNotEntered は `value ? value : NOT_ENTERED` という falsy 判定のため、
  // 数値の0は「0という入力」ではなく「未入力」として扱われる。
  // 現状すべての呼び出し元は文字列専用（金額等の数値はorNotEntered呼び出し前に
  // フォーマット済み文字列へ変換している）ため実害はないが、将来
  // 数値をそのまま渡す呼び出しを追加する際は注意が必要（このテストは
  // その挙動を意図的に固定するための回帰テスト）。
  assert.equal(orNotEntered(0), NOT_ENTERED);
});

test("buildTitleHeading: 見出し1段落を1つ返す", () => {
  const heading = buildTitleHeading("様式第一号 サマリー");
  assert.ok(heading instanceof Paragraph);
});

test("buildSubHeading: 見出し3段落を1つ返す", () => {
  const heading = buildSubHeading("営業所: 本店");
  assert.ok(heading instanceof Paragraph);
});

test("buildDisclaimerParagraph: 正式様式ではない旨の注記段落を1つ返す", () => {
  const disclaimer = buildDisclaimerParagraph();
  assert.ok(disclaimer instanceof Paragraph);
});

test("buildLabeledTable: 行数に応じたTableを組み立てる", () => {
  const table = buildLabeledTable([
    ["ラベル1", "値1"],
    ["ラベル2", "値2"],
    ["ラベル3", "値3"],
  ]);
  assert.ok(table instanceof Table);
});

test("buildLabeledTable: 空配列でもTableを組み立てられる", () => {
  const table = buildLabeledTable([]);
  assert.ok(table instanceof Table);
});

test("buildHeaderedTable: 列見出し行＋データ行のTableを組み立てる", () => {
  const table = buildHeaderedTable(
    ["建設工事の種類", "元請/下請", "注文者"],
    [["建築工事業", "元請", "A社"]]
  );
  assert.ok(table instanceof Table);
});

test("buildHeaderedTable: データ行が0件でもヘッダー行のみのTableを組み立てられる", () => {
  const table = buildHeaderedTable(["列1", "列2"], []);
  assert.ok(table instanceof Table);
});

test("buildBulletList: itemsが空配列なら何も返さない", () => {
  const paragraphs = buildBulletList("見出し", []);
  assert.deepEqual(paragraphs, []);
});

test("buildBulletList: itemsがundefinedでも何も返さない", () => {
  const paragraphs = buildBulletList("見出し", undefined);
  assert.deepEqual(paragraphs, []);
});

test("buildBulletList: 見出し段落1つ＋項目数分の箇条書き段落を返す", () => {
  const paragraphs = buildBulletList("判定理由", ["理由1", "理由2", "理由3"]);
  assert.equal(paragraphs.length, 4); // 見出し1 + 項目3
  assert.ok(paragraphs.every((p) => p instanceof Paragraph));
});

test("buildBulletList: warning=trueでも見出し段落1つ＋項目数分の段落数は変わらない", () => {
  const paragraphs = buildBulletList("警告", ["注意事項1", "注意事項2"], { warning: true });
  assert.equal(paragraphs.length, 3);
  assert.ok(paragraphs.every((p) => p instanceof Paragraph));
});
