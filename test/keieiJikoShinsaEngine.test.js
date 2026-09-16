import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateKeieiJikoShinsaReadiness, formatKeieiJikoShinsaReport } from "../src/licenses/keiei-jiko-shinsa/eligibility/engine.js";
import { buildSampleKeieiJikoShinsaProfile, buildSampleClientWithConstruction } from "../scripts/sampleKeieiJikoShinsaProfile.js";

test("evaluateKeieiJikoShinsaReadiness: サンプルデータは全要件を満たしeligible=trueになる", () => {
  const result = evaluateKeieiJikoShinsaReadiness(buildSampleKeieiJikoShinsaProfile(), buildSampleClientWithConstruction());
  assert.equal(result.eligible, true);
  assert.equal(result.checks.length, 3);
});

test("evaluateKeieiJikoShinsaReadiness: 建設業許可を持たないクライアントではeligible=falseになる", () => {
  const clientRecord = { clientName: "無許可の会社", licenses: [] };
  const result = evaluateKeieiJikoShinsaReadiness(buildSampleKeieiJikoShinsaProfile(), clientRecord);
  assert.equal(result.eligible, false);
});

test("evaluateKeieiJikoShinsaReadiness: Yが未申請ならeligible=falseになる", () => {
  const profile = buildSampleKeieiJikoShinsaProfile();
  profile.yBunsekiStatus = "未申請";
  const result = evaluateKeieiJikoShinsaReadiness(profile, buildSampleClientWithConstruction());
  assert.equal(result.eligible, false);
});

test("formatKeieiJikoShinsaReport: 評点は計算していない旨の注記を必ず含む", () => {
  const profile = buildSampleKeieiJikoShinsaProfile();
  const result = evaluateKeieiJikoShinsaReadiness(profile, buildSampleClientWithConstruction());
  const report = formatKeieiJikoShinsaReport(profile, result);
  assert.match(report, /評点.*計算していません/);
});

test("formatKeieiJikoShinsaReport: 全要件充足なら総合判定が○になる", () => {
  const profile = buildSampleKeieiJikoShinsaProfile();
  const result = evaluateKeieiJikoShinsaReadiness(profile, buildSampleClientWithConstruction());
  const report = formatKeieiJikoShinsaReport(profile, result);
  assert.match(report, /総合判定: ○/);
});

test("formatKeieiJikoShinsaReport: 不合格の要件があれば総合判定が×になり未充足の要因まとめが出力される", () => {
  const clientRecord = { clientName: "無許可の会社", licenses: [] };
  const profile = buildSampleKeieiJikoShinsaProfile();
  const result = evaluateKeieiJikoShinsaReadiness(profile, clientRecord);
  const report = formatKeieiJikoShinsaReport(profile, result);
  assert.match(report, /総合判定: ×/);
  assert.match(report, /未充足の要因まとめ/);
});
