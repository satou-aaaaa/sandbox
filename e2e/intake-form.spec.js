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

/**
 * Issue #227: 役員ごとの欠格事由（建設業法第8条第12号）・令3条使用人・
 * 未成年者の法定代理人（第11号）の入力欄の疎通確認。
 * 個々の判定ロジックの正しさは test/formPageClient.test.js・
 * features/construction-kekkaku.feature で検証済みのため、ここでは
 * 「実際のブラウザで展開・入力・送信ができるか」に限定する。
 */
test("インテイクフォーム: 役員の欠格事由（折りたたみ）・令3条使用人・法定代理人の入力欄を操作できる", async ({ page }) => {
  await page.goto("/");

  await page.locator("#applicantName").fill("E2Eテスト建設株式会社（欠格事由）");
  await page.locator("#applicantType").selectOption("個人");

  // 役員の欠格事由（折りたたみ）を展開して1項目チェックする。
  const officerRow = page.locator("#officersContainer .officer-row").first();
  await officerRow.locator(".officer-name").fill("山田 太郎");
  await officerRow.locator("summary").click();
  await officerRow.locator(".officer-kekkaku-confirmed").check();
  await officerRow.locator(".officer-kekkaku-isUndischargedBankrupt").check();
  await expect(officerRow.locator(".officer-kekkaku-isUndischargedBankrupt")).toBeChecked();

  // 令3条使用人の行を追加して入力する。
  const employeeRows = page.locator("#regulatoryEmployeesContainer .regulatory-employee-row");
  await expect(employeeRows).toHaveCount(0);
  await page.getByRole("button", { name: "＋ 令3条使用人を追加" }).click();
  await expect(employeeRows).toHaveCount(1);
  await employeeRows.first().locator(".employee-name").fill("田中 次郎");
  await employeeRows.first().locator("summary").click();
  await employeeRows.first().locator(".employee-kekkaku-confirmed").check();

  // 未成年者の法定代理人セクションを表示・入力する。
  await page.locator("#isMinor").check();
  await page.locator("#legalRepresentativeName").fill("山田 一郎");
  await page.locator(".legalRep-kekkaku-details summary").click();
  await page.locator(".legalRep-kekkaku-confirmed").check();

  await page.getByRole("button", { name: "要件判定＋書類サマリーを生成する" }).click();
  await expect(page.locator("h1")).toContainText("要件判定結果");
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
