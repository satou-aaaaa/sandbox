import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Document } from "docx";
import { PRE_SEAL_CHECKLIST, buildReviewPackDocument, resolveReviewPack, writeReviewPackDocx } from "../src/core/documents/reviewPack.js";
import { evaluateEligibility } from "../src/licenses/construction/eligibility/engine.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

const check = (key, label, passed, reasons = [], warnings = []) => ({ key, label, passed, reasons, warnings });

test("resolveReviewPack: 渡された判定結果をそのまま並べる（合否を再計算しない）", () => {
  // eligible=true と各要件の合否が矛盾するデータでも、渡された値をそのまま使う（再計算していない証拠）
  const r = resolveReviewPack({
    title: "T",
    applicantLabel: "A",
    generatedDateIso: "2026-09-30",
    eligibility: {
      eligible: true,
      checks: [check("a", "要件A", true, ["理由A"], ["確認A"]), check("b", "要件B", false, ["理由B"])],
      blockingIssues: [],
      consistencyWarnings: [{ key: "k", message: "気づき1" }],
    },
  });
  assert.equal(r.verdict, "全要件を満たす（一次スクリーニング）");
  assert.deepEqual(r.checkRows, [["○", "要件A", "理由A"], ["×", "要件B", "理由B"]]);
  assert.deepEqual(r.unmet, [{ label: "要件B", reasons: ["理由B"] }]);
  assert.deepEqual(r.warnings, ["[要件A] 確認A"]);
  assert.deepEqual(r.consistency, ["気づき1"]);
  assert.equal(r.actionCount, 3);
});

test("resolveReviewPack: 期限は日付の昇順、理由が空なら注記、書類は既定で空", () => {
  const r = resolveReviewPack({
    title: "T",
    applicantLabel: "A",
    generatedDateIso: "2026-09-30",
    eligibility: { eligible: false, checks: [check("a", "要件A", false, [])], blockingIssues: ["x"] },
    deadlines: [{ label: "後", dueDateIso: "2027-01-01" }, { label: "先", dueDateIso: "2026-10-01" }],
  });
  assert.equal(r.verdict, "未充足の要件あり");
  assert.deepEqual(r.deadlines.map((d) => d[1]), ["先", "後"]);
  assert.equal(r.checkRows[0][2], "（理由の記載なし）");
  assert.deepEqual(r.documentLabels, []);
});

test("buildReviewPackDocument / writeReviewPackDocx: 実際の建設業許可の判定結果からdocxを書き出せる", async () => {
  const eligibility = evaluateEligibility(buildSampleApplicantProfile());
  const input = { title: "建設業許可申請", applicantLabel: "サンプル建設株式会社", eligibility, generatedDateIso: "2026-09-30", documentLabels: ["様式第一号"] };
  assert.ok(buildReviewPackDocument(input) instanceof Document);
  const dir = await mkdtemp(join(tmpdir(), "reviewpack-"));
  try {
    const out = join(dir, "sub", "pack.docx");
    await writeReviewPackDocx(input, out);
    const buf = await readFile(out);
    assert.equal(buf.subarray(0, 2).toString(), "PK"); // docx は zip
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("PRE_SEAL_CHECKLIST: 押印・提出を人が行うことを明記している", () => {
  assert.ok(PRE_SEAL_CHECKLIST.some((s) => s.includes("押印・提出は") && s.includes("自動化しない")));
});
