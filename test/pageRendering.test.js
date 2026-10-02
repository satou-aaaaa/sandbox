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
import { renderKobutsuFormPage } from "../src/web/kobutsuFormPage.js";
import { renderNouchiTenyoFormPage } from "../src/web/nouchiTenyoFormPage.js";
import { REMINDER_RANGES } from "../src/core/reminders/digest.js";

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

test("renderDraftsPage: 下書きが0件なら「保存済みの下書きはありません。」を表示し、<table>は表示しない", () => {
  const html = renderDraftsPage({ drafts: [] });
  assert.match(html, /保存済みの下書きはありません。/);
  assert.doesNotMatch(html, /<table>/);
});

test("renderDraftsPage: applicantNameに含まれるHTMLタグをエスケープする", () => {
  const html = renderDraftsPage({
    drafts: [
      {
        id: "abc123",
        savedAt: "2026-09-12T00:00:00.000Z",
        profile: { applicantName: "<script>alert(1)</script>" },
      },
    ],
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("renderDraftsPage: idに含まれる特殊文字をURLエンコードしてリンク・削除フォームのactionに使う", () => {
  const html = renderDraftsPage({
    drafts: [{ id: "a b/c", savedAt: "2026-09-12T00:00:00.000Z", profile: {} }],
  });
  assert.match(html, /href="\/drafts\/a%20b%2Fc"/);
  assert.match(html, /action="\/drafts\/a%20b%2Fc\/delete"/);
});

test("renderKobutsuFormPage: errorを指定するとエラーメッセージ用のブロックを表示する", () => {
  const html = renderKobutsuFormPage({ error: "テスト用エラー" });
  assert.match(html, /class="error"/);
  assert.match(html, /入力内容の処理中にエラーが発生しました: テスト用エラー/);
});

test("renderKobutsuFormPage: errorを指定しなければエラーブロックは表示されない", () => {
  const html = renderKobutsuFormPage();
  assert.doesNotMatch(html, /class="error"/);
});

test("renderKobutsuFormPage: errorに含まれるHTMLタグをエスケープする", () => {
  const html = renderKobutsuFormPage({ error: "<b>x</b>" });
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test("renderNouchiTenyoFormPage: errorを指定するとエラーメッセージ用のブロックを表示する", () => {
  const html = renderNouchiTenyoFormPage({ error: "テスト用エラー" });
  assert.match(html, /class="error"/);
  assert.match(html, /入力内容の処理中にエラーが発生しました: テスト用エラー/);
});

test("renderNouchiTenyoFormPage: errorを指定しなければエラーブロックは表示されない", () => {
  const html = renderNouchiTenyoFormPage();
  assert.doesNotMatch(html, /class="error"/);
});

test("renderNouchiTenyoFormPage: errorに含まれるHTMLタグをエスケープする", () => {
  const html = renderNouchiTenyoFormPage({ error: "<b>x</b>" });
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

// #206: renderResultPage のラベル差替え・エスケープ・リンク生成
test("renderResultPage: result.eligibleに応じて既定の総合判定文言とバッジのクラスが切り替わる", () => {
  const base = {
    profile: { applicantName: "テスト建設" },
    report: "",
    files: [],
    sessionId: "test-session",
  };

  const okHtml = renderResultPage({ ...base, result: { eligible: true } });
  assert.match(okHtml, /class="badge ok"/);
  assert.match(okHtml, /○ 5要件すべて充足（申請準備を進められます）/);

  const ngHtml = renderResultPage({ ...base, result: { eligible: false } });
  assert.match(ngHtml, /class="badge ng"/);
  assert.match(ngHtml, /× 未充足の要件があります/);
});

test("renderResultPage: judgmentLabelsを渡すと既定文言ではなくその文言が表示される（片方のみ指定時はもう片方は既定文言のまま）", () => {
  const html = renderResultPage({
    profile: { applicantName: "テスト商会" },
    result: { eligible: true },
    report: "",
    files: [],
    sessionId: "test-session",
    judgmentLabels: { ok: "○ 独自の合格文言" },
  });
  assert.match(html, /○ 独自の合格文言/);
  assert.doesNotMatch(html, /○ 5要件すべて充足（申請準備を進められます）/);

  const ngHtml = renderResultPage({
    profile: { applicantName: "テスト商会" },
    result: { eligible: false },
    report: "",
    files: [],
    sessionId: "test-session",
    judgmentLabels: { ok: "○ 独自の合格文言" },
  });
  assert.match(ngHtml, /× 未充足の要件があります/);
});

test("renderResultPage: formPathを渡すと戻りリンクがそのパスになる。未指定時は / になる", () => {
  const base = {
    profile: { applicantName: "テスト商会" },
    result: { eligible: true },
    report: "",
    files: [],
    sessionId: "test-session",
  };

  const withFormPath = renderResultPage({ ...base, formPath: "/kobutsu" });
  assert.match(withFormPath, /href="\/kobutsu"/);

  const withoutFormPath = renderResultPage(base);
  assert.match(withoutFormPath, /href="\/"/);
});

test("renderResultPage: sessionIdやfilenameの特殊文字をダウンロードリンクでURLエンコードする", () => {
  const html = renderResultPage({
    profile: { applicantName: "テスト商会" },
    result: { eligible: true },
    report: "",
    files: [{ label: "申請書", filename: "a b/c" }],
    sessionId: "a b/c",
  });
  assert.match(html, /\/download\/a%20b%2Fc\/a%20b%2Fc/);
});

test("renderResultPage: applicantName・report・files[].labelに含まれるHTMLタグをエスケープする", () => {
  const html = renderResultPage({
    profile: { applicantName: "<script>alert(1)</script>" },
    result: { eligible: true },
    report: "<script>alert(2)</script>",
    files: [{ label: "<script>alert(3)</script>", filename: "f.docx" }],
    sessionId: "test-session",
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<script>alert\(2\)<\/script>/);
  assert.doesNotMatch(html, /<script>alert\(3\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(html, /&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
});

// #207: renderReminderPage の絞り込みナビとエスケープ
test("renderReminderPage: activeRange未指定(null)のとき「すべて」がstrongで、他の区分はリンクになる", () => {
  const html = renderReminderPage({ report: "", clientCount: 0 });
  assert.match(html, /<strong>すべて<\/strong>/);
  for (const { key, label } of REMINDER_RANGES) {
    assert.match(html, new RegExp(`<a href="/reminders\\?range=${key}">${label}</a>`));
  }
});

test("renderReminderPage: activeRangeに先頭区分を渡すと、その区分だけstrongになり「すべて」はリンクになる", () => {
  const [{ key: activeKey, label: activeLabel }] = REMINDER_RANGES;
  const html = renderReminderPage({ report: "", clientCount: 0, activeRange: activeKey });
  assert.match(html, new RegExp(`<strong>${activeLabel}</strong>`));
  assert.match(html, /<a href="\/reminders">すべて<\/a>/);
  for (const { key, label } of REMINDER_RANGES) {
    if (key === activeKey) continue;
    assert.match(html, new RegExp(`<a href="/reminders\\?range=${key}">${label}</a>`));
  }
});

test("renderReminderPage: reportに含まれるHTMLタグをエスケープする", () => {
  const html = renderReminderPage({ report: "<script>alert(1)</script>", clientCount: 0 });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("renderReminderPage: メール下書きリンクの対象アラートのclientName・labelに含まれるHTMLタグをエスケープする", () => {
  const html = renderReminderPage({
    report: "",
    clientCount: 1,
    actionableAlerts: [
      {
        clientName: "<script>alert(1)</script>",
        type: "license-expiry",
        label: "<script>alert(2)</script>",
        dueDateIso: "2026-09-01",
        daysUntil: 0,
        isOverdue: false,
        contactEmail: "info@example.com",
        licenseId: "construction-1",
      },
    ],
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<script>alert\(2\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
});
