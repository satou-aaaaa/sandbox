import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKeieiJikoShinsaPrerequisite } from "../src/licenses/keiei-jiko-shinsa/eligibility/prerequisite.js";

/** @returns {import('../src/core/reminders/digest.js').ClientRecord} */
function clientWithConstruction() {
  return {
    clientName: "サンプル建設",
    licenses: [{ licenseId: "般-建築工事業", licenseCategory: "construction", grantDateIso: "2024-04-01" }],
  };
}

test("checkKeieiJikoShinsaPrerequisite: 建設業許可を保有しなければ、他の入力によらず即座に不合格", () => {
  const clientRecord = { clientName: "無許可の会社", licenses: [{ licenseId: "x", licenseCategory: "kobutsu" }] };
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: true, targetGyoshu: ["とび・土工工事業"] },
    clientRecord
  );
  assert.equal(result.passed, false);
  assert.ok(result.reasons[0].includes("建設業許可"));
});

test("checkKeieiJikoShinsaPrerequisite: licenseCategory省略（既定=construction）の許可も建設業許可として認識する", () => {
  const clientRecord = { clientName: "サンプル建設", licenses: [{ licenseId: "般-建築工事業", grantDateIso: "2024-04-01" }] };
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: true, targetGyoshu: ["とび・土工工事業"] },
    clientRecord
  );
  assert.equal(result.passed, true);
});

test("checkKeieiJikoShinsaPrerequisite: 決算変更届が未提出なら不合格", () => {
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: false, targetGyoshu: ["とび・土工工事業"] },
    clientWithConstruction()
  );
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("決算変更届")));
});

test("checkKeieiJikoShinsaPrerequisite: 業種区分が1件も無ければ不合格", () => {
  const result = checkKeieiJikoShinsaPrerequisite({ isKessanHenkoTodokeSubmitted: true, targetGyoshu: [] }, clientWithConstruction());
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("業種区分")));
});

test("checkKeieiJikoShinsaPrerequisite: 建設業許可保有・決算変更届提出済み・業種区分選択済みなら合格", () => {
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: true, targetGyoshu: ["とび・土工工事業"] },
    clientWithConstruction()
  );
  assert.equal(result.passed, true);
});

test("checkKeieiJikoShinsaPrerequisite: licensesが未定義のクライアントも、許可なしとして不合格になる（オプショナルチェイニング）", () => {
  const clientRecord = { clientName: "許可未登録" };
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: true, targetGyoshu: ["とび・土工工事業"] },
    clientRecord
  );
  assert.equal(result.passed, false);
  assert.ok(result.reasons[0].includes("建設業許可"));
});

test("checkKeieiJikoShinsaPrerequisite: 建設業許可を保有しない場合のkey・label・warningsを厳密に確認", () => {
  const clientRecord = { clientName: "無許可の会社", licenses: [{ licenseId: "x", licenseCategory: "kobutsu" }] };
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: true, targetGyoshu: ["とび・土工工事業"] },
    clientRecord
  );
  assert.equal(result.key, "keieiJikoShinsaPrerequisite");
  assert.equal(result.label, "経審受審の前提条件");
  assert.deepEqual(result.warnings, []);
});

test("checkKeieiJikoShinsaPrerequisite: 合格時のkey・label・warnings・reasonsを厳密に確認", () => {
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: true, targetGyoshu: ["とび・土工工事業"] },
    clientWithConstruction()
  );
  assert.equal(result.key, "keieiJikoShinsaPrerequisite");
  assert.equal(result.label, "経審受審の前提条件");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.reasons, ["建設業許可の保有・決算変更届の提出・業種区分の選択、いずれも確認できました。"]);
});

test("checkKeieiJikoShinsaPrerequisite: 不合格時は合格メッセージを含まない（決算変更届未提出）", () => {
  const result = checkKeieiJikoShinsaPrerequisite(
    { isKessanHenkoTodokeSubmitted: false, targetGyoshu: ["とび・土工工事業"] },
    clientWithConstruction()
  );
  assert.deepEqual(result.reasons, [
    "直近決算分の決算変更届が未提出です。経審の申請には最新の決算内容を反映した決算変更届が前提書類として必要です。",
  ]);
});
