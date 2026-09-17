/**
 * アクセシビリティテスト（axe-core + jsdom）。
 *
 * 【なぜ導入したか】これまでのテスト（node --testのユニットテスト・fast-checkの
 * property-based testing・Strykerのミューテーションテスト）はすべて「ロジックが
 * 正しいか」を検証するものだった。一方、`src/web/*Page.js` が生成するHTMLは
 * 実際に発注者本人（今後は顧客からのヒアリング時にも使う可能性がある）が
 * ブラウザで操作する画面であり、「その画面が実際に使えるか」という別の観点の
 * 検証が抜けていた。axe-core（Deque社製、業界標準のアクセシビリティ検査
 * エンジン）を使い、各画面が生成するHTMLをWCAG等の自動検査可能なルールに
 * 照らして検証する。
 *
 * 【なぜjsdomか】実ブラウザ（Playwright等）を導入する案もあったが、
 * `docs/DESIGN.md` 7章の既存方針（「本ツールには外部サービスとの連携や
 * UI操作を伴う画面遷移がないため、ブラウザを実際に起動するE2Eテストは
 * 導入していない」）を踏まえ、まずは`test/formPageClient.test.js`で既に
 * 使っているjsdomの上でaxe-coreを動かす、より軽量な構成から始める。
 * 【既知の制約】jsdomはレンダリングエンジンを持たないため、`color-contrast`
 * （文字色と背景色のコントラスト比）ルールは正しく動作しない
 * （axe-core公式ドキュメントに明記された既知の制約）。このルールのみ
 * 無効化し、それ以外（ラベル関連付け・見出し構造・ランドマーク・
 * テーブル構造等、静的なHTML構造から判定可能なルール）は有効なまま検証する。
 * 色のコントラスト比の確認は、実際にブラウザで目視確認する運用に委ねる。
 *
 * 【発見した実際の不具合】導入時の初回実行で、以下2件の実際のアクセシビリティ
 * 上の不具合が見つかり、修正した:
 * - `formPage.js`の役員追加行（`officerRowTemplate`）の入力欄に
 *   ラベルが無く、スクリーンリーダー利用者が何を入力する欄か判別できなかった
 *   （axeの重要度: critical）→ 各inputに`aria-label`を付与して解消
 * - 4画面すべてで`<body>`直下のコンテンツが`<main>`等のランドマークに
 *   含まれておらず、支援技術での画面構造把握を妨げていた（重要度: moderate）
 *   → 各画面のコンテンツを`<main>`で囲んで解消
 * - `draftsPage.js`の下書き一覧テーブルで、操作列の見出し（`<th>`）が
 *   空文字列だった（重要度: minor）→ 「入力再開」「削除」という見出し文言を追加
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import axeCore from "axe-core";
import { renderFormPage } from "../src/web/formPage.js";
import { renderKobutsuFormPage } from "../src/web/kobutsuFormPage.js";
import { renderResultPage } from "../src/web/resultPage.js";
import { renderReminderPage } from "../src/web/reminderPage.js";
import { renderDraftsPage } from "../src/web/draftsPage.js";
import { buildSampleApplicantProfile } from "../scripts/sampleProfile.js";

/**
 * 指定したHTMLをjsdomで読み込み、axe-coreで検査する。
 * axe-coreは通常ブラウザに読み込ませて使うライブラリのため、jsdomの
 * window内に<script>としてソースを注入し、window.axeとして呼び出す
 * （axe-core公式のNode.js/jsdom向け利用パターン）。
 * @param {string} html
 * @returns {Promise<import('axe-core').AxeResults>}
 */
async function runAxe(html) {
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
  const scriptEl = dom.window.document.createElement("script");
  scriptEl.textContent = axeCore.source;
  dom.window.document.head.appendChild(scriptEl);
  return dom.window.axe.run(dom.window.document, {
    rules: { "color-contrast": { enabled: false } }, // jsdomでは正しく動作しないため無効化（axe-core既知の制約）
  });
}

/** @param {import('axe-core').AxeResults} results */
function formatViolations(results) {
  return results.violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}件)\n  ${v.nodes.map((n) => n.html).join("\n  ")}`)
    .join("\n\n");
}

test("renderFormPage: アクセシビリティ違反が無い（インテイクフォーム。初期状態）", async () => {
  const results = await runAxe(renderFormPage());
  assert.equal(results.violations.length, 0, formatViolations(results));
});

test("renderFormPage: 役員・営業所・工事経歴の行を追加した状態でもアクセシビリティ違反が無い", async () => {
  // buildProfile()相当のブラウザ側JSは動かさず、サーバー側が生成する初期HTML
  // （<template>の中身）自体に対象を絞って直接検証する。テンプレートの中身は
  // ブラウザ側JSでクローンされるだけで内容は変わらないため、テンプレート内の
  // HTML片を単体で検査すれば、行を追加した後の状態も同じ結果になる。
  const html = renderFormPage();
  const dom = new JSDOM(html);
  const templateIds = ["officerRowTemplate", "officeRowTemplate", "constructionHistoryRowTemplate"];
  for (const id of templateIds) {
    const template = dom.window.document.getElementById(id);
    assert.ok(template, `テンプレート #${id} が見つかりません`);
    // <template>の中身はページ本体のDOMツリーとは別（inert）なので、
    // 中身だけを取り出し、有効なHTMLドキュメントとして包んでから検査する。
    // <title>・<main>はこのテスト用ラッパー自体に起因する誤検知
    // （document-title・region違反）を避けるために付与している
    // （実際のページでは既に満たされており、ここでの関心事はテンプレート
    // 内の要素自体にラベル等の不備が無いかの一点に絞るため）。
    const fragmentHtml = `<!doctype html><html lang="ja"><head><title>test</title></head><body><main>${template.innerHTML}</main></body></html>`;
    const results = await runAxe(fragmentHtml);
    assert.equal(results.violations.length, 0, `#${id}:\n${formatViolations(results)}`);
  }
});

test("renderKobutsuFormPage: アクセシビリティ違反が無い（古物商許可インテイクフォーム。初期状態）", async () => {
  const results = await runAxe(renderKobutsuFormPage());
  assert.equal(results.violations.length, 0, formatViolations(results));
});

test("renderKobutsuFormPage: 営業所行を追加した状態でもアクセシビリティ違反が無い", async () => {
  const html = renderKobutsuFormPage();
  const dom = new JSDOM(html);
  const template = dom.window.document.getElementById("eigyoshoRowTemplate");
  assert.ok(template, "テンプレート #eigyoshoRowTemplate が見つかりません");
  const fragmentHtml = `<!doctype html><html lang="ja"><head><title>test</title></head><body><main>${template.innerHTML}</main></body></html>`;
  const results = await runAxe(fragmentHtml);
  assert.equal(results.violations.length, 0, formatViolations(results));
});

test("renderResultPage: アクセシビリティ違反が無い（判定結果画面。合格・不合格の両方）", async () => {
  const profile = buildSampleApplicantProfile();
  for (const eligible of [true, false]) {
    const html = renderResultPage({
      profile,
      result: { eligible, checks: [], blockingIssues: eligible ? [] : ["財産的基礎: 未充足"] },
      report: "# 判定レポート\n\nダミーのレポート本文",
      files: [{ label: "様式第一号", filename: "youshiki1.docx" }],
      sessionId: "test-session",
    });
    const results = await runAxe(html);
    assert.equal(results.violations.length, 0, `eligible=${eligible}:\n${formatViolations(results)}`);
  }
});

test("renderReminderPage: アクセシビリティ違反が無い（リマインド画面。メール下書きリンク表示あり）", async () => {
  const html = renderReminderPage({
    report: "# 更新リマインド・ダイジェスト\n\nダミーの本文",
    clientCount: 2,
    actionableAlerts: [
      {
        clientName: "テスト建設",
        type: "renewal-deadline",
        label: "更新申請の最終締切",
        dueDateIso: "2026-10-01",
        daysUntil: 10,
        isOverdue: false,
        contactEmail: "info@example.com",
        licenseId: "既定",
      },
    ],
    activeRange: "overdue",
  });
  const results = await runAxe(html);
  assert.equal(results.violations.length, 0, formatViolations(results));
});

test("renderDraftsPage: アクセシビリティ違反が無い（下書き一覧画面。下書きあり・なしの両方）", async () => {
  const withDrafts = await runAxe(
    renderDraftsPage({
      drafts: [{ id: "abc123", savedAt: new Date().toISOString(), profile: { applicantName: "テスト建設" } }],
    })
  );
  assert.equal(withDrafts.violations.length, 0, formatViolations(withDrafts));

  const withoutDrafts = await runAxe(renderDraftsPage({ drafts: [] }));
  assert.equal(withoutDrafts.violations.length, 0, formatViolations(withoutDrafts));
});
