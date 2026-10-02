import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateInshokutenEligibility, formatInshokutenEligibilityReport } from "../src/licenses/inshokuten-eigyo/eligibility/engine.js";
import { HACCP_CONTINUING_OBLIGATION_NOTICE } from "../src/licenses/inshokuten-eigyo/eligibility/disclaimer.js";
import { buildSampleInshokutenEigyoProfile } from "../scripts/sampleInshokutenEigyoProfile.js";

test("evaluateInshokutenEligibility: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateInshokutenEligibility(buildSampleInshokutenEigyoProfile());
  assert.equal(result.eligible, true);
  assert.equal(result.blockingIssues.length, 0);
  assert.equal(result.checks.length, 2);
});

test("evaluateInshokutenEligibility: 施設基準を満たさなければeligible=falseになる", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  profile.shisetsu.sinkCount = 1;
  const result = evaluateInshokutenEligibility(profile);
  assert.equal(result.eligible, false);
});

test("evaluateInshokutenEligibility: 食品衛生責任者要件を満たさなければeligible=falseになる", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  profile.sekininsha.qualificationType = "未定";
  const result = evaluateInshokutenEligibility(profile);
  assert.equal(result.eligible, false);
});

test("HACCP_CONTINUING_OBLIGATION_NOTICE: 注記の全文が欠落・改変されていない", () => {
  // report内でのincludes検証（下記テスト）は同じ定数同士の比較のため、
  // 定数自体の一部の文が空文字列等に化けても検出できない
  // （ミューテーションテストで発見。CHANGELOG.md参照）。
  assert.equal(
    HACCP_CONTINUING_OBLIGATION_NOTICE,
    "※ HACCPに沿った衛生管理（またはHACCPの考え方を取り入れた衛生管理）の" +
      "実施は、飲食店営業許可の交付要件ではありません。許可取得後に、原則" +
      "すべての事業者に義務付けられる継続的な衛生管理です（食品衛生法第51条）。" +
      "本判定結果が「○」であっても、HACCPに沿った衛生管理計画の策定・記録は" +
      "別途必要となりますので、開業後速やかに対応してください。"
  );
});

test("formatInshokutenEligibilityReport: HACCP継続義務の注記が必ず含まれる（NFR-I1。eligible=trueの場合）", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  const result = evaluateInshokutenEligibility(profile);
  const report = formatInshokutenEligibilityReport(profile, result);
  assert.ok(report.includes(HACCP_CONTINUING_OBLIGATION_NOTICE));
});

test("formatInshokutenEligibilityReport: HACCP継続義務の注記が必ず含まれる（NFR-I1。eligible=falseの場合）", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  profile.shisetsu.sinkCount = 1;
  const result = evaluateInshokutenEligibility(profile);
  const report = formatInshokutenEligibilityReport(profile, result);
  assert.ok(report.includes(HACCP_CONTINUING_OBLIGATION_NOTICE));
});

test("formatInshokutenEligibilityReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  const result = evaluateInshokutenEligibility(profile);
  const report = formatInshokutenEligibilityReport(profile, result);
  assert.match(report, /総合判定: ○/);
  // 見出し行（店舗名）・総合判定行・各要件セクションが、余計な文言を挟まず
  // それぞれ空行で区切られて並ぶこと（行の追加・削除を検知するため）
  assert.ok(report.startsWith(`# 飲食店営業許可 要件判定結果 — ${profile.businessName}\n\n総合判定: ○`));
  assert.ok(report.includes("要件を充足（申請準備を進められます）\n\n## ○ 施設基準"));
  assert.doesNotMatch(report, /未充足の要因まとめ/);
});

test("formatInshokutenEligibilityReport: 見出しは屋号（businessName）未設定時のみ申請者名（applicantName）にフォールバックする", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  const result = evaluateInshokutenEligibility(profile);
  // businessNameが設定されている場合はそれが優先される（??であり&&ではない）
  assert.ok(formatInshokutenEligibilityReport(profile, result).includes(profile.businessName));

  profile.businessName = undefined;
  const fallbackReport = formatInshokutenEligibilityReport(profile, result);
  assert.ok(fallbackReport.startsWith(`# 飲食店営業許可 要件判定結果 — ${profile.applicantName}`));
});

test("formatInshokutenEligibilityReport: 不合格の要件があれば総合判定が×になり、未充足の要因まとめが出力される", () => {
  const profile = buildSampleInshokutenEigyoProfile();
  profile.shisetsu.sinkCount = 1;
  const result = evaluateInshokutenEligibility(profile);
  const report = formatInshokutenEligibilityReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
  // 要因まとめの中身（ラベル＋理由）が実際に出力されることと、その直後は
  // 空行を挟んで注記が続くこと（余計な行が挟まらないこと）を検証する
  assert.ok(report.includes("- [施設基準（厨房・換気・給排水・手洗い設備等）] シンクが2槽未満です（2槽以上が目安）"));
  assert.ok(report.includes("シンクが2槽未満です（2槽以上が目安）\n\n" + HACCP_CONTINUING_OBLIGATION_NOTICE));
});

/**
 * 【ミューテーションテストで判明した等価ミュータント（2026年10月・#79）】
 * `engine.js`の`return lines.join("\n").trimEnd();`で`trimEnd`を`trimStart`に
 * 置き換えるミュータントが生存する。`lines`の先頭要素は常にタイトル行、末尾
 * 要素は常に注記（`HACCP_CONTINUING_OBLIGATION_NOTICE`）で、いずれも空白文字
 * で始まる／終わることが無いため、`trimEnd`・`trimStart`のどちらでも出力は
 * 変わらない等価ミュータントである（gijinkoku/eligibility/engine.jsと同型）。
 */
