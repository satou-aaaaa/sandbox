import { test, expect } from "@playwright/test";

/**
 * インテイクフォームの実ブラウザ経由での疎通確認（E2E・golden path）。
 *
 * 個々の要件判定ロジックの正しさ（法定要件の分岐網羅・境界値等）は
 * 既存のユニットテスト・ミューテーションテストが担っているため、ここでは
 * 「実際にブラウザで入力→送信→結果画面確認という一連の操作が壊れていないか」
 * の疎通確認に限定する（playwright.config.js冒頭のコメント参照）。
 */

test("インテイクフォーム: 申請者名を入力して送信すると、判定結果画面が表示される", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("建設業許可 申請者情報インテイク");

  await page.locator("#applicantName").fill("E2Eテスト建設株式会社");
  await page.locator("#representativeName").fill("山田 太郎");

  await page.getByRole("button", { name: "要件判定＋書類サマリーを生成する" }).click();

  // /submit へのPOST後、結果画面（resultPage.js）へ遷移する。
  await expect(page.locator("h1")).toContainText("要件判定結果 — E2Eテスト建設株式会社");
  await expect(page.locator("h2")).toContainText(["判定レポート"]);
  // 生成された書類サマリー（docx）へのダウンロードリンクが最低1件表示される。
  await expect(page.locator('a[href*="/download/"]').first()).toBeVisible();
});

test("インテイクフォーム: 役員・営業所の行を追加/削除できる", async ({ page }) => {
  await page.goto("/");

  const officerRows = page.locator("#officersContainer .officer-row");
  const officeRows = page.locator("#officesContainer .office-row");
  // 新規フォームは初期状態で役員1件・営業所1件の空行を持つ
  // （test/formPageClient.test.jsのユニットテストで検証済みの仕様）。
  await expect(officerRows).toHaveCount(1);
  await expect(officeRows).toHaveCount(1);

  await page.getByRole("button", { name: "＋ 役員を追加" }).click();
  await expect(officerRows).toHaveCount(2);

  await officerRows.nth(1).getByRole("button", { name: "削除" }).click();
  await expect(officerRows).toHaveCount(1);
});

test("インテイクフォーム: 下書きとして保存すると、保存済み通知とともにフォームが再表示される", async ({ page }) => {
  await page.goto("/");
  await page.locator("#applicantName").fill("下書きE2Eテスト建設");

  await page.getByRole("button", { name: "下書きとして保存" }).click();

  await expect(page.locator(".saved-notice")).toBeVisible();
  await expect(page.locator("#applicantName")).toHaveValue("下書きE2Eテスト建設");

  // 保存した下書きが一覧画面にも表示されることを確認する。
  await page.goto("/drafts");
  await expect(page.locator("table")).toContainText("下書きE2Eテスト建設");
});

test("リマインド画面: JSエラー無くページが表示される（クライアント未登録の状態）", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto("/reminders");
  await expect(page.locator("h1")).toHaveText("更新リマインド・ダイジェスト");

  expect(errors).toEqual([]);
});
