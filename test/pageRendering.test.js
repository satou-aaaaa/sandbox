/**
 * src/web/*Page.js の各レンダリング関数を、HTTP層を介さず直接呼び出して
 * 検証するテスト。web.test.js（HTTP結合テスト）ではserver.js側のルーティングが
 * 実際に組み立てるオプションの組み合わせしか通らないため、各ページ関数が
 * 公開契約として受け付けるオプション（JSDoc上は許容されるが、現在の
 * server.js からは渡されることのない組み合わせ）の分岐を個別に確認する。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderFormPage } from "../src/web/formPage.js";
import { renderResultPage } from "../src/web/resultPage.js";
import { renderReminderPage } from "../src/web/reminderPage.js";
import { renderDraftsPage } from "../src/web/draftsPage.js";

test("renderFormPage: errorを指定するとエラーメッセージ用のブロックを表示する", () => {
  const html = renderFormPage({ error: "テストエラー内容" });
  assert.match(html, /入力内容の処理中にエラーが発生しました: テストエラー内容/);
});

test("renderFormPage: errorを指定しなければエラーブロックは表示されない", () => {
  const html = renderFormPage();
  assert.doesNotMatch(html, /入力内容の処理中にエラーが発生しました/);
});

test("renderResultPage: applicantNameが未入力ならタイトル・見出しに既定のフォールバック文言を使う", () => {
  const html = renderResultPage({
    profile: { applicantName: "" },
    result: { eligible: true, checks: [], blockingIssues: [] },
    report: "",
    files: [],
    sessionId: "test-session",
  });
  assert.match(html, /<title>判定結果 — kensetsu-kyoka-toolkit<\/title>/);
  assert.match(html, /<h1>要件判定結果 — （未入力）<\/h1>/);
});

test("renderReminderPage: actionableAlertsが未指定(undefined)でもエラーにならず「連絡が必要な件」欄を表示しない（||の分岐網羅）", () => {
  const html = renderReminderPage({ report: "対象のリマインドはありません。", clientCount: 0 });
  assert.doesNotMatch(html, /連絡が必要な件（メール下書きを開く）/);
});

test("renderReminderPage: licenseIdを持たないアラート（決算変更届等）は許可ラベルを付与しない（三項演算子の分岐網羅）", () => {
  const html = renderReminderPage({
    report: "",
    clientCount: 1,
    actionableAlerts: [
      {
        clientName: "テスト建設",
        type: "kessan-henko",
        label: "決算変更届の提出期限",
        dueDateIso: "2026-09-01",
        daysUntil: 0,
        isOverdue: false,
        contactEmail: "info@example.com",
        // licenseId は付与しない（決算変更届はクライアント単位のリマインドのため）
      },
    ],
  });
  assert.match(html, /テスト建設 — 決算変更届の提出期限/);
  assert.doesNotMatch(html, /テスト建設（許可:/);
});

test("renderDraftsPage: 下書きのプロフィールにapplicantNameが無ければ「（名称未設定）」と表示する（||の分岐網羅）", () => {
  const html = renderDraftsPage({
    drafts: [{ id: "abc123", savedAt: "2026-09-12T00:00:00.000Z", profile: {} }],
  });
  assert.match(html, /（名称未設定）/);
});
