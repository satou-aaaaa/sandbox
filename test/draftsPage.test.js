/**
 * 下書き一覧画面（src/web/draftsPage.js）の表示ロジックのテスト。
 * アクセシビリティ観点は test/accessibility.test.js 側でカバーする。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDraftsPage } from "../src/web/draftsPage.js";
import { DRAFT_STALE_THRESHOLD_DAYS } from "../src/web/draftStore.js";

test("renderDraftsPage: 作成から30日以内の下書きには警告を表示しない", () => {
  const html = renderDraftsPage({
    drafts: [{ id: "a", savedAt: new Date().toISOString(), profile: { applicantName: "テスト建設" } }],
  });
  assert.ok(!html.includes(`class="stale-warning"`));
});

test("renderDraftsPage: 作成から30日を超えた下書きには経過日数の警告を表示する（Issue #183）", () => {
  const oldSavedAt = new Date(Date.now() - (DRAFT_STALE_THRESHOLD_DAYS + 5) * 24 * 60 * 60 * 1000).toISOString();
  const html = renderDraftsPage({
    drafts: [{ id: "a", savedAt: oldSavedAt, profile: { applicantName: "テスト建設" } }],
  });
  assert.ok(html.includes(`class="stale-warning"`));
  assert.ok(html.includes(`${DRAFT_STALE_THRESHOLD_DAYS}日以上経過`));
});

test("renderDraftsPage: 下書きが無い場合は警告も出ない", () => {
  const html = renderDraftsPage({ drafts: [] });
  assert.ok(!html.includes(`class="stale-warning"`));
});
