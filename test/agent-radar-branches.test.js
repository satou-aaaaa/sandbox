// agent/radar-lib.js の、既存テストで通っていなかった分岐（欠けた改正履歴・直近施行の事実・不正な報告）を確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRadarFacts, lawPageUrl, parseLawRevisions, parseRadarFindings } from "../agent/radar-lib.js";

const NOW = new Date("2026-10-01T00:00:00Z");

test("parseLawRevisions: 施行日の無い改正は飛ばし、公布日・改正法名が無ければ空文字にする", () => {
  const r = parseLawRevisions(
    "324AC0000000100",
    {
      law_info: { law_title: "テスト法" },
      revisions: [{ amendment_law_title: "日付なし" }, { amendment_enforcement_date: "2026-09-01" }],
    },
    NOW,
  );
  assert.deepEqual(r, [{ lawId: "324AC0000000100", title: "テスト法", enforcementDate: "2026-09-01", promulgateDate: "", amendmentTitle: "", kind: "recent" }]);
});

test("buildRadarFacts: 直近に施行された改正は、その旨と「不明」の欄を書く", () => {
  const { facts, urls } = buildRadarFacts({
    laws: [{ lawId: "324AC0000000100", title: "テスト法", kind: "recent", enforcementDate: "2026-09-01", promulgateDate: "", amendmentTitle: "" }],
    node: null,
  });
  const url = lawPageUrl("324AC0000000100");
  assert.deepEqual(urls, [url]);
  assert.equal(facts.length, 1);
  assert.match(facts[0], /直近に施行された改正。施行日 2026-09-01、公布日 不明、改正法 不明。/);
  assert.ok(facts[0].endsWith(`出典: ${url}`));
});

test("parseRadarFindings: 文字列でない・長さの合わない、見出しの欠けた報告は捨てる", () => {
  const url = lawPageUrl("324AC0000000100");
  const body = `概要。緊急度: 中。\n## 根拠\n${url} と src/core/a.js:10\n## 推奨対応\n一次資料で改正内容を確認する。${"説明".repeat(30)}`;
  const line = (title, b) => JSON.stringify({ title, body: b });
  const okTitle = "法令改正: テスト法の改正への対応を確認する";
  const text = [
    line(12345678901, body),
    line(okTitle, null),
    line("短い", body),
    line("あ".repeat(101), body),
    line(okTitle, `## 根拠\n${url}\n## 推奨対応`),
    line(okTitle, body + "あ".repeat(4000)),
    line(okTitle, body.replace("## 推奨対応", "## 対応")),
    line(okTitle, body.replace("## 根拠", "## 出典")),
  ].join("\n");
  assert.deepEqual(parseRadarFindings(text, [url]), []);
  assert.deepEqual(parseRadarFindings(`${text}\n${line(okTitle, body)}`, [url]), [{ title: okTitle, body }]);
});
