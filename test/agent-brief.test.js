import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEF_MAX_CHARS, BRIEF_REQUIRED_HEADINGS, buildBriefPrompt, extractBrief, formatBriefComment, isBriefCandidate } from "../agent/policy.js";

const issue = (labels, author = "satou-aaaaa") => ({ number: 5, title: "決めたいこと", body: "本文", author: { login: author }, labels: labels.map((name) => ({ name })) });
const fullBrief = BRIEF_REQUIRED_HEADINGS.map((h) => `${h}\n内容`).join("\n\n");

test("isBriefCandidate: 所有者起票・人手が必要・資料未作成のIssueだけが対象（障害・対象外・処理中・第三者は除く）", () => {
  assert.equal(isBriefCandidate(issue(["agent-needs-human"])), true);
  for (const extra of ["agent-briefed", "agent-skip", "agent-working", "agent-incident"]) {
    assert.equal(isBriefCandidate(issue(["agent-needs-human", extra])), false, extra);
  }
  assert.equal(isBriefCandidate(issue([])), false);
  assert.equal(isBriefCandidate(issue(["agent-needs-human"], "someone-else")), false);
});

test("buildBriefPrompt: Issue本文をデータとして区切り、必須の見出しをすべて指示する", () => {
  const p = buildBriefPrompt(issue(["agent-needs-human"]));
  for (const h of BRIEF_REQUIRED_HEADINGS) assert.ok(p.includes(h), h);
  assert.match(p, /<issue-body>\n本文\n<\/issue-body>/);
});

test("extractBrief: 必須の見出しが揃った資料だけを取り出し（前置きは除く）、欠けていれば null、長すぎれば省略する", () => {
  assert.equal(extractBrief(`前置き\n${fullBrief}`), fullBrief);
  assert.equal(extractBrief(fullBrief.replace("## 事実と推測", "## 別の見出し")), null);
  assert.equal(extractBrief("見出しなし"), null);
  assert.equal(extractBrief(/** @type {any} */ (undefined)), null);
  const long = extractBrief(`${fullBrief}\n${"あ".repeat(BRIEF_MAX_CHARS)}`);
  assert.ok(long && long.length < BRIEF_MAX_CHARS + 100 && long.includes("省略"));
});

test("formatBriefComment: 判断は所有者が行うこと・資料の作り直し方を添える", () => {
  const c = formatBriefComment(fullBrief);
  assert.match(c, /判断は所有者が行います/);
  assert.match(c, /agent-briefed/);
  assert.ok(c.includes(fullBrief));
});
