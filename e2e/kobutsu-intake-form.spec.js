import { test, expect } from "@playwright/test";

/**
 * 古物商許可インテイクフォームの実ブラウザ経由での疎通確認（E2E・golden path）。
 * 建設業許可のe2e/intake-form.spec.jsと同じ位置づけ（法定要件の分岐網羅は
 * 既存のユニットテストが担い、ここでは実際にブラウザで入力→送信→結果画面
 * 確認という一連の操作が壊れていないかの疎通確認に限定する）。
 */

test("古物商許可インテイクフォーム: 申請者名・営業所を入力して送信すると、判定結果画面が表示される", async ({ page }) => {
  await page.goto("/kobutsu");
  await expect(page.locator("h1")).toHaveText("古物商許可 申請者情報インテイク");

  await page.locator("#applicantName").fill("E2Eテスト太郎");
  await page.locator("#address").fill("東京都サンプル区1-2-3");

  const eigyoshoRows = page.locator("#eigyoshoContainer .eigyosho-row");
  await expect(eigyoshoRows).toHaveCount(1);
  await eigyoshoRows.first().locator(".eigyosho-officeName").fill("本店");
  await eigyoshoRows.first().locator(".eigyosho-managerName").fill("E2Eテスト太郎");

  await page.getByRole("button", { name: "要件判定＋書類サマリーを生成する" }).click();

  // /kobutsu/submit へのPOST後、結果画面（resultPage.js）へ遷移する。
  await expect(page.locator("h1")).toContainText("要件判定結果 — E2Eテスト太郎");
  await expect(page.locator("h2")).toContainText(["判定レポート"]);
  // 生成された書類サマリー（docx）へのダウンロードリンクが最低1件表示される。
  await expect(page.locator('a[href*="/download/"]').first()).toBeVisible();
  // 「新しい申請者情報を入力する」リンクは建設業許可のフォーム（"/"）ではなく
  // 古物商許可のフォーム（"/kobutsu"）へ戻る（resultPage.jsのformPathオプション）。
  await expect(page.getByRole("link", { name: "← 新しい申請者情報を入力する" })).toHaveAttribute("href", "/kobutsu");
});

test("古物商許可インテイクフォーム: 営業所の行を追加/削除できる", async ({ page }) => {
  await page.goto("/kobutsu");

  const eigyoshoRows = page.locator("#eigyoshoContainer .eigyosho-row");
  await expect(eigyoshoRows).toHaveCount(1);

  await page.getByRole("button", { name: "＋ 営業所を追加" }).click();
  await expect(eigyoshoRows).toHaveCount(2);

  await eigyoshoRows.nth(1).getByRole("button", { name: "削除" }).click();
  await expect(eigyoshoRows).toHaveCount(1);
});

test("建設業許可インテイクフォームから古物商許可インテイクフォームへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "→ 古物商許可のインテイクフォームへ" }).click();
  await expect(page.locator("h1")).toHaveText("古物商許可 申請者情報インテイク");
});
