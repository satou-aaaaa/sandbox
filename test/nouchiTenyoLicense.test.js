import { test } from "node:test";
import assert from "node:assert/strict";
import { registerNouchiTenyoLicense } from "../src/licenses/nouchi-tenyo/index.js";
import { getScheduleFn, clearScheduleFns } from "../src/core/reminders/scheduleTypes.js";

test("registerNouchiTenyoLicense: 'nouchi-tenyo'キーでスケジュール計算関数を登録する", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  assert.equal(typeof getScheduleFn("nouchi-tenyo"), "function");
});

test("registerNouchiTenyoLicense: nouchiTenyoDetail未設定の許可は空配列（リマインドなし）を返す", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  assert.deepEqual(scheduleFn({ licenseId: "既定" }), []);
});

test("registerNouchiTenyoLicense: 条件が付されていなければ空配列を返す", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  assert.deepEqual(scheduleFn({ licenseId: "既定", nouchiTenyoDetail: { article: "4条" } }), []);
});

test("registerNouchiTenyoLicense: 工事着手期限のみ設定されていれば1件返す", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  const items = scheduleFn({ licenseId: "既定", nouchiTenyoDetail: { constructionStartDeadlineIso: "2026-12-01" } });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "construction-start-deadline");
  assert.equal(items[0].dueDateIso, "2026-12-01");
  assert.ok(items[0].label.includes("許可取消し"));
});

test("registerNouchiTenyoLicense: 完了報告期限のみ設定されていれば1件返す", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  const items = scheduleFn({ licenseId: "既定", nouchiTenyoDetail: { completionReportDeadlineIso: "2027-03-01" } });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "completion-report-deadline");
});

test("registerNouchiTenyoLicense: 両方設定されていれば2件返す", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  const items = scheduleFn({
    licenseId: "既定",
    nouchiTenyoDetail: { constructionStartDeadlineIso: "2026-12-01", completionReportDeadlineIso: "2027-06-01" },
  });
  assert.equal(items.length, 2);
});

test("registerNouchiTenyoLicense: 着手済みフラグが立てば工事着手期限のリマインドは消える（完了報告期限は独立して残る）", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  const items = scheduleFn({
    licenseId: "既定",
    nouchiTenyoDetail: {
      constructionStartDeadlineIso: "2026-12-01",
      constructionStartReported: true,
      completionReportDeadlineIso: "2027-06-01",
    },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "completion-report-deadline");
});

test("registerNouchiTenyoLicense: 完了報告済みフラグが立てば完了報告期限のリマインドが消える", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  const items = scheduleFn({
    licenseId: "既定",
    nouchiTenyoDetail: { completionReportDeadlineIso: "2027-06-01", completionReported: true },
  });
  assert.deepEqual(items, []);
});

test("registerNouchiTenyoLicense: 両方の履行済みフラグが立てば空配列になる", () => {
  clearScheduleFns();
  registerNouchiTenyoLicense();
  const scheduleFn = getScheduleFn("nouchi-tenyo");
  const items = scheduleFn({
    licenseId: "既定",
    nouchiTenyoDetail: {
      constructionStartDeadlineIso: "2026-12-01",
      constructionStartReported: true,
      completionReportDeadlineIso: "2027-06-01",
      completionReported: true,
    },
  });
  assert.deepEqual(items, []);
});
