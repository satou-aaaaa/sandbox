import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIncorporationScheduleAlerts } from "../src/incorporation/reminders/incorporationSchedule.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "../scripts/sampleIncorporationCase.js";

const TODAY = "2026-09-16";

test("buildIncorporationScheduleAlerts: 完了済み案件は除外される", () => {
  const c = buildSampleKabushikiKaishaCase();
  c.status = "完了";
  c.ninshoYoteiIso = "2026-10-01";
  const alerts = buildIncorporationScheduleAlerts([c], TODAY);
  assert.deepEqual(alerts, []);
});

test("buildIncorporationScheduleAlerts: 合同会社の案件は認証リマインドの対象にならない（ninshoYoteiIso未設定。FR-I4.1）", () => {
  const c = buildSampleGodoKaishaCase();
  c.funsoKigenIso = "2026-10-01";
  const alerts = buildIncorporationScheduleAlerts([c], TODAY);
  assert.ok(!alerts.some((a) => a.type === "teikan-ninsho"));
});

test("buildIncorporationScheduleAlerts: 株式会社の定款認証予約日がリマインドされる", () => {
  const c = buildSampleKabushikiKaishaCase();
  c.ninshoYoteiIso = "2026-10-01";
  const alerts = buildIncorporationScheduleAlerts([c], TODAY);
  const alert = alerts.find((a) => a.type === "teikan-ninsho");
  assert.ok(alert);
  assert.equal(alert.dueDateIso, "2026-10-01");
  assert.equal(alert.isOverdue, false);
});

test("buildIncorporationScheduleAlerts: 払込完了済み（funsoKanryoIso設定済み）の案件は払込期限リマインドの対象から除外される（FR-I3.3）", () => {
  const c = buildSampleKabushikiKaishaCase();
  c.funsoKigenIso = "2026-10-01";
  c.funsoKanryoIso = "2026-09-15";
  const alerts = buildIncorporationScheduleAlerts([c], TODAY);
  assert.ok(!alerts.some((a) => a.type === "funso-kigen"));
});

test("buildIncorporationScheduleAlerts: 払込期限超過の案件はisOverdue: trueになる", () => {
  const c = buildSampleKabushikiKaishaCase();
  c.funsoKigenIso = "2026-09-01";
  const alerts = buildIncorporationScheduleAlerts([c], TODAY);
  const alert = alerts.find((a) => a.type === "funso-kigen");
  assert.ok(alert);
  assert.equal(alert.isOverdue, true);
});

test("buildIncorporationScheduleAlerts: 複数案件を日付の近い順にソートして返す", () => {
  const c1 = buildSampleKabushikiKaishaCase();
  c1.caseId = "case-1";
  c1.funsoKigenIso = "2026-12-01";
  const c2 = buildSampleGodoKaishaCase();
  c2.caseId = "case-2";
  c2.funsoKigenIso = "2026-10-01";
  const alerts = buildIncorporationScheduleAlerts([c1, c2], TODAY);
  assert.equal(alerts[0].dueDateIso, "2026-10-01");
  assert.equal(alerts[1].dueDateIso, "2026-12-01");
});

test("buildIncorporationScheduleAlerts: 期日が何も設定されていない案件はリマインドを生成しない", () => {
  const c = buildSampleKabushikiKaishaCase();
  const alerts = buildIncorporationScheduleAlerts([c], TODAY);
  assert.deepEqual(alerts, []);
});
