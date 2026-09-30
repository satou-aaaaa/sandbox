import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeMutation } from "../scripts/lib/mutationSummary.mjs";

const m = (status, line = 1, mutatorName = "ConditionalExpression", replacement = "true") => ({ status, mutatorName, replacement, location: { start: { line } } });

test("summarizeMutation: スコア・生き残り・未到達を集計する", () => {
  const r = summarizeMutation({
    files: {
      "src/a.js": { mutants: [m("Killed"), m("Killed"), m("Survived", 10), m("NoCoverage", 20), m("Ignored")] },
      "src/b.js": { mutants: [m("Timeout"), m("Survived", 3, "EqualityOperator", ">")] },
    },
  });
  assert.equal(r.total, 6);
  assert.equal(r.killed, 3);
  assert.equal(r.survived, 2);
  assert.equal(r.noCoverage, 1);
  assert.equal(r.score, 50);
  assert.match(r.markdown, /スコア \*\*50%\*\*/);
  assert.match(r.markdown, /`src\/a\.js`/);
  assert.match(r.markdown, /テスト未到達/);
});

test("summarizeMutation: ミュータントが無ければスコアは null", () => {
  const r = summarizeMutation({ files: {} });
  assert.equal(r.score, null);
  assert.match(r.markdown, /対象のミュータントがありません/);
});

test("summarizeMutation: 詳細の行数は maxLines で切る", () => {
  const mutants = Array.from({ length: 10 }, (_, i) => m("Survived", i + 1));
  const r = summarizeMutation({ files: { "src/a.js": { mutants } } }, { maxLines: 3 });
  assert.equal((r.markdown.match(/^- `src\/a\.js:/gm) ?? []).length, 3);
});
