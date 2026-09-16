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
