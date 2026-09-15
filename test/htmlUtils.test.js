import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
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

/**
 * ここからProperty-based testing（fast-check）。
 *
 * 上のテストは「この入力に対してはこの出力になる」という個別の具体例だが、
 * XSS対策の要となるescapeHtmlは「どんな入力が来ても、HTMLとして危険な
 * 生の記号が絶対に出力に残らない」という"入力によらず常に成り立つべき性質"の
 * 方が本質的に重要である。fast-checkはランダムな（境界値を狙った）入力を
 * 大量に生成して性質を検証し、反例が見つかった場合は最小の反例に
 * 絞り込んで（shrinking）報告してくれる。具体例ベースのテストでは
 * 書き手が思いついた入力しか検証できないのに対し、この手法は
 * 書き手が想定していない入力（制御文字・サロゲートペア単体・非常に長い
 * 文字列等）も含めて検証できる点が異なる。
 */
test("escapeHtml [property]: どんな文字列を入力しても、出力に生の < > \" ' は残らない（XSS対策の本質的性質）", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const output = escapeHtml(input);
      assert.ok(!output.includes("<"));
      assert.ok(!output.includes(">"));
      assert.ok(!output.includes('"'));
      assert.ok(!output.includes("'"));
    })
  );
});

test("escapeHtml [property]: 出力に含まれる全ての&は、5種類のエンティティのいずれかの一部である（二重エスケープ防止の性質）", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const output = escapeHtml(input);
      // &amp; &lt; &gt; &quot; &#39; の5種類のエンティティを全て取り除いたときに
      // "&" が1つも残らなければ、すべての"&"がいずれかのエンティティの一部であるとわかる。
      const withEntitiesRemoved = output.replace(/&(amp|lt|gt|quot|#39);/g, "");
      assert.ok(!withEntitiesRemoved.includes("&"), `未知の&が残存: ${JSON.stringify(output)}`);
    })
  );
});

test("escapeHtml [property]: 冪等ではない（エスケープ済み文字列を再度渡すと&が再エスケープされる＝二重エスケープに注意が必要なことの明示）", () => {
  // これは「望ましい性質」ではなく、むしろ呼び出し側が注意すべき既知の制約を
  // 明文化するテスト。escapeHtml(escapeHtml(x)) !== escapeHtml(x) となりうるため、
  // 呼び出し側でescapeHtmlを二重に適用しないよう注意が必要（実際、src/web/*Page.js
  // は生の値に対して1回だけ適用する設計になっている）。
  fc.assert(
    fc.property(
      fc.string().filter((s) => /[&<>"']/.test(s)),
      (input) => {
        const once = escapeHtml(input);
        const twice = escapeHtml(once);
        assert.notEqual(twice, once);
      }
    )
  );
});
