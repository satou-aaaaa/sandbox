import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKoushu } from "../src/licenses/sanpai/eligibility/koushu.js";

test("checkKoushu: 発行日から5年以内の申請予定日なら合格する", () => {
  const result = checkKoushu({ completionDateIso: "2024-04-01", plannedApplicationDateIso: "2026-09-16" });
  assert.equal(result.passed, true);
  assert.ok(result.reasons[0].includes("2029-04-01"));
});

test("checkKoushu: 申請予定日が有効期限ちょうどなら合格する（境界値）", () => {
  const result = checkKoushu({ completionDateIso: "2024-04-01", plannedApplicationDateIso: "2029-04-01" });
  assert.equal(result.passed, true);
});

test("checkKoushu: 申請予定日が有効期限の翌日なら不合格（境界値）", () => {
  const result = checkKoushu({ completionDateIso: "2024-04-01", plannedApplicationDateIso: "2029-04-02" });
  assert.equal(result.passed, false);
  assert.ok(result.reasons[0].includes("再受講が必要"));
});

test("checkKoushu: 申請予定日が明らかに有効期限を過ぎていれば不合格", () => {
  const result = checkKoushu({ completionDateIso: "2015-04-01", plannedApplicationDateIso: "2026-09-16" });
  assert.equal(result.passed, false);
});
