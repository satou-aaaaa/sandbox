import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReportMarkdown,
  compareWithBaseline,
  describeChange,
  egovLawId,
  impactedDocs,
  needsAttention,
  normalizeHtml,
  snapshotEgov,
  snapshotHtml,
} from "../scripts/lib/lawWatch.mjs";
import { extractHeaderUrls } from "../scripts/lib/legalBasis.mjs";

const egovJson = (revisionId, enforcement, body, scheduled = null) => ({
  revision_info: { law_title: "テスト法", law_revision_id: revisionId, amendment_enforcement_date: enforcement, amendment_scheduled_enforcement_date: scheduled },
  law_info: { law_num: "x" },
  law_full_text: body,
});

test("egovLawId: e-Gov法令URLだけから法令IDを取り出す", () => {
  assert.equal(egovLawId("https://laws.e-gov.go.jp/law/324AC0000000108"), "324AC0000000108");
  assert.equal(egovLawId("https://laws.e-gov.go.jp/law/324AC0000000108/20250601"), "324AC0000000108");
  assert.equal(egovLawId("https://www.mlit.go.jp/x.html"), null);
});

test("normalizeHtml: スクリプト・タグ・空白の揺れを除き、タイトルを取る", () => {
  const a = normalizeHtml("<html><head><title> T </title><script>var x=1;</script></head><body><p>本文  &amp; あ</p><!-- c --></body></html>");
  const b = normalizeHtml("<html><head><title>T</title><style>p{}</style></head><body>\n<p>本文 & あ</p></body></html>");
  assert.equal(a.title, "T");
  assert.equal(a.text, "T 本文 & あ");
  assert.equal(snapshotHtml("<p>あ</p>").hash, snapshotHtml("<div>\n あ </div>").hash);
  assert.equal(b.text.includes("p{}"), false);
});

test("describeChange: e-Gov は版の更新・施行予定・本文のみの変化を区別する", () => {
  const base = snapshotEgov(egovJson("R1", "2025-01-01", { a: 1 }));
  assert.deepEqual(describeChange(base, snapshotEgov(egovJson("R1", "2025-01-01", { a: 1 }))), []);
  assert.match(describeChange(base, snapshotEgov(egovJson("R2", "2026-01-01", { a: 2 })))[0], /版が更新/);
  assert.match(describeChange(base, snapshotEgov(egovJson("R1", "2025-01-01", { a: 1 }, "2027-04-01")))[0], /施行予定.*2027-04-01/);
  assert.match(describeChange(base, snapshotEgov(egovJson("R1", "2025-01-01", { a: 9 })))[0], /条文の内容が変わりました/);
});

test("describeChange: HTML は本文ハッシュの変化を検知する", () => {
  assert.deepEqual(describeChange(snapshotHtml("<p>a</p>"), snapshotHtml("<p>a</p>")), []);
  assert.equal(describeChange(snapshotHtml("<p>a</p>"), snapshotHtml("<p>b</p>")).length, 1);
});

test("compareWithBaseline / needsAttention: 変化・失敗・新規・参照なしを分類する", () => {
  const same = snapshotHtml("<p>same</p>");
  const baseline = { "https://a/": same, "https://b/": snapshotHtml("<p>old</p>"), "https://c/": same, "https://gone/": same };
  const sources = new Map([
    ["https://a/", ["src/a.js"]],
    ["https://b/", ["src/b.js"]],
    ["https://c/", ["src/c.js"]],
    ["https://new/", ["src/n.js"]],
  ]);
  const results = new Map([
    ["https://a/", { ok: true, snapshot: same }],
    ["https://b/", { ok: true, snapshot: snapshotHtml("<p>new</p>") }],
    ["https://c/", { ok: false, error: "HTTP 404" }],
    ["https://new/", { ok: true, snapshot: same }],
  ]);
  const report = compareWithBaseline(baseline, sources, results);
  assert.equal(report.unchanged, 1);
  assert.deepEqual(report.changed.map((c) => c.url), ["https://b/"]);
  assert.deepEqual(report.failed.map((f) => [f.url, f.neverFetched]), [["https://c/", false]]);
  assert.deepEqual(report.added.map((a) => a.url), ["https://new/"]);
  assert.deepEqual(report.removed, ["https://gone/"]);
  assert.equal(needsAttention(report), true);

  const md = buildReportMarkdown(report, "2026-09-30");
  assert.match(md, /2026-09-30/);
  assert.match(md, /https:\/\/b\/[\s\S]*`src\/b\.js`/);
  assert.match(md, /HTTP 404/);
});

test("needsAttention: 新規URLや参照なしだけなら人の対応は不要、基準線の無いURLの取得失敗も同様", () => {
  const report = compareWithBaseline({ "https://gone/": snapshotHtml("x") }, new Map([["https://new/", ["f.js"]], ["https://never/", ["g.js"]]]), new Map([["https://new/", { ok: true, snapshot: snapshotHtml("y") }], ["https://never/", { ok: false, error: "timeout" }]]));
  assert.equal(needsAttention(report), false);
});

test("extractHeaderUrls: 末尾の句読点・括弧を除き、重複をまとめる", () => {
  const src = "/**\n * 参照: https://laws.e-gov.go.jp/law/1 。\n * (https://example.com/a).\n * https://laws.e-gov.go.jp/law/1\n */\n";
  assert.deepEqual(extractHeaderUrls(src), ["https://laws.e-gov.go.jp/law/1", "https://example.com/a"]);
});

test("normalizeHtml: &amp;lt; を二重にアンエスケープしない（&lt; という文字列のまま残る）", () => {
  assert.equal(normalizeHtml("<p>&amp;lt; と &lt;b&gt; と &amp;</p>").text, "&lt; と <b> と &");
});

test("impactedDocs: 根拠を挙げるファイルから設計書を割り出し、実在しない候補は除く", () => {
  const all = new Set(["docs/DESIGN.md", "docs/REQUIREMENTS.md", "docs/DESIGN_kobutsu-core.md", "docs/REQUIREMENTS_kobutsu-core.md", "docs/DESIGN_souzoku-support.md"]);
  const exists = (p) => all.has(p);
  assert.deepEqual(impactedDocs(["src/licenses/kobutsu/eligibility/rules/a.js"], exists), ["docs/DESIGN_kobutsu-core.md", "docs/REQUIREMENTS_kobutsu-core.md"]);
  assert.deepEqual(impactedDocs(["src/licenses/construction/eligibility/a.js", "src/core/reminders/deadlines.js"], exists), ["docs/DESIGN.md", "docs/REQUIREMENTS.md"]);
  assert.deepEqual(impactedDocs(["src/succession/heirs/x.js"], exists), ["docs/DESIGN_souzoku-support.md"]);
  assert.deepEqual(impactedDocs(["src/web/x.js", "scripts/y.mjs"], exists), []);
});

test("compareWithBaseline / buildReportMarkdown: 存在確認を渡すと、変化のあったURLに設計書が付く", () => {
  const url = "https://laws.e-gov.go.jp/law/1";
  const before = snapshotEgov(egovJson("r1", "2026-01-01", "旧"));
  const now = snapshotEgov(egovJson("r2", "2026-06-01", "新"));
  const sources = new Map([[url, ["src/licenses/kobutsu/eligibility/a.js"]]]);
  const report = compareWithBaseline({ [url]: before }, sources, new Map([[url, { ok: true, snapshot: now }]]), () => true);
  assert.deepEqual(report.changed[0].docs, ["docs/DESIGN_kobutsu-core.md", "docs/REQUIREMENTS_kobutsu-core.md"]);
  assert.match(buildReportMarkdown(report, "2026-09-30"), /見直し対象の設計書: `docs\/DESIGN_kobutsu-core\.md`/);
  const plain = compareWithBaseline({ [url]: before }, sources, new Map([[url, { ok: true, snapshot: now }]]));
  assert.equal(plain.changed[0].docs, undefined);
});
