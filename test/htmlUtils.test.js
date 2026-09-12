import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../src/web/htmlUtils.js";

test("escapeHtml: 5種類の特殊文字（& < > \" '）をすべてエスケープする", () => {
  assert.equal(escapeHtml(`& < > " '`), "&amp; &lt; &gt; &quot; &#39;");
});

test("escapeHtml: <script>タグを含む入力を無害化する（XSS対策の要）", () => {
  const result = escapeHtml(`<script>alert("xss")</script>`);
  assert.ok(!result.includes("<script>"));
  assert.equal(result, "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
});

test("escapeHtml: 属性値へのエスケープ抜け出しを防ぐ（onerror付きimgタグ）", () => {
  const result = escapeHtml(`"><img src=x onerror=alert(1)>`);
  assert.ok(!result.includes('">'));
  assert.ok(!result.includes("<img"));
});

test("escapeHtml: 特殊文字を含まない通常の文字列はそのまま返す", () => {
  assert.equal(escapeHtml("テスト建設株式会社"), "テスト建設株式会社");
});

test("escapeHtml: null・undefinedは空文字列として扱う", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml: 数値・真偽値も文字列に変換してから処理する", () => {
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(123), "123");
  assert.equal(escapeHtml(false), "false");
});

test("escapeHtml: 空文字列は空文字列のまま返す", () => {
  assert.equal(escapeHtml(""), "");
});

test("escapeHtml: &を含む文字列は&amp;に変換した後、他の文字を再エスケープしない（二重エスケープ防止の確認）", () => {
  // "&lt;" という文字列そのものが入力された場合、& だけがエスケープされ
  // "&amp;lt;" になるべきで、他の記号は元々含まれていないため影響しないことを確認する。
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});
