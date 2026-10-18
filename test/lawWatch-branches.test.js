// scripts/lib/lawWatch.mjs の、既存テストで通っていなかった分岐（欠けた応答・取得方法の変化・設計書の対応付け）を確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareWithBaseline, describeChange, impactedDocs, needsAttention, snapshotEgov, snapshotHtml } from "../scripts/lib/lawWatch.mjs";

test("snapshotEgov: 応答が空・欠けていても落ちず、既定値で要約する", () => {
  const empty = snapshotEgov(null);
  assert.equal(empty.kind, "egov");
  assert.equal(empty.title, "");
  assert.equal(empty.revisionId, "");
  assert.equal(empty.enforcementDate, null);
  assert.equal(empty.scheduledDate, null);
  // law_full_text が無いときは null として要約するため、空のオブジェクトと同じ指紋になる
  assert.equal(snapshotEgov({}).hash, empty.hash);
  assert.notEqual(snapshotEgov({ law_full_text: { a: 1 } }).hash, empty.hash);
});

test("snapshotEgov: revision_info に題名が無ければ法令番号を題名にする", () => {
  assert.equal(snapshotEgov({ law_info: { law_num: "昭和二十四年法律第百号" } }).title, "昭和二十四年法律第百号");
  assert.equal(snapshotEgov({ revision_info: {}, law_info: {} }).title, "");
});

test("describeChange: 取得方法（html ↔ egov）が変わったことを伝える", () => {
  const html = snapshotHtml("<p>本文</p>");
  const egov = snapshotEgov({ revision_info: { law_revision_id: "R1" } });
  assert.deepEqual(describeChange(html, egov), ["取得方法が変わりました（html → egov）"]);
  assert.deepEqual(describeChange(egov, html), ["取得方法が変わりました（egov → html）"]);
});

test("describeChange: 施行日が分からない版の更新は「不明」と書く", () => {
  const before = snapshotEgov({ revision_info: { law_revision_id: "R1" } });
  const now = snapshotEgov({ revision_info: { law_revision_id: "R2", amendment_enforcement_date: "2027-04-01" } });
  assert.deepEqual(describeChange(before, now), ["法令の版が更新されました（R1 → R2、施行日 不明 → 2027-04-01）"]);
  assert.deepEqual(describeChange(now, before), ["法令の版が更新されました（R2 → R1、施行日 2027-04-01 → 不明）"]);
});

test("describeChange: 文字数が記録されていない古い基準線でも、本文の変化を伝える", () => {
  const now = snapshotHtml("<p>新しい本文</p>");
  const [msg] = describeChange({ kind: "html", hash: "old" }, now);
  assert.match(msg, new RegExp(`^ページ本文が変わりました（\\?字 → ${now.chars}字）`));
  const [msg2] = describeChange(now, { kind: "html", hash: "other" });
  assert.match(msg2, new RegExp(`（${now.chars}字 → \\?字）`));
});

test("impactedDocs: 会社設立・受付ポータルの対応する設計書を割り出す", () => {
  const all = () => true;
  assert.deepEqual(impactedDocs(["src/incorporation/forms/teikan.js"], all), ["docs/DESIGN_kaisha-secchi-support.md", "docs/REQUIREMENTS_kaisha-secchi-support.md"]);
  assert.deepEqual(impactedDocs(["src/portal/cases.js"], all), ["docs/DESIGN_uketsuke-portal.md", "docs/REQUIREMENTS_uketsuke-portal.md"]);
  // 実在しない候補は除く
  assert.deepEqual(impactedDocs(["src/portal/cases.js"], (p) => p.startsWith("docs/DESIGN_")), ["docs/DESIGN_uketsuke-portal.md"]);
});

test("compareWithBaseline: 取得結果が無いURLは「未取得」の失敗として扱う", () => {
  const url = "https://www.mlit.go.jp/x.html";
  const before = snapshotHtml("<p>a</p>");
  const report = compareWithBaseline({ [url]: before }, new Map([[url, ["src/core/a.js"]]]), new Map());
  assert.deepEqual(report.failed, [{ url, files: ["src/core/a.js"], error: "未取得", neverFetched: false }]);
  // 基準線のあるURLが取れないのは、人の対応が必要
  assert.equal(needsAttention(report), true);
  const fresh = compareWithBaseline({}, new Map([[url, ["src/core/a.js"]]]), new Map());
  assert.equal(fresh.failed[0].neverFetched, true);
  assert.equal(needsAttention(fresh), false);
});
