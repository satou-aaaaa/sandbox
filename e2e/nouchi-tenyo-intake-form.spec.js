import { test, expect } from "@playwright/test";

/**
 * 農地転用許可インテイクフォームの実ブラウザ経由での疎通確認（E2E・golden path）。
 * 古物商許可のe2e/kobutsu-intake-form.spec.jsと同じ位置づけ（法定要件の
 * 分岐網羅は既存のユニットテストが担い、ここでは実際にブラウザで
 * 入力→送信→結果画面確認という一連の操作が壊れていないかの疎通確認に限定する）。
 */

test("農地転用許可インテイクフォーム: 申請者情報を入力して送信すると、判定結果画面が表示される", async ({ page }) => {
  await page.goto("/nouchi-tenyo");
  await expect(page.locator("h1")).toHaveText("農地転用許可 申請者情報インテイク");

  await page.locator("#applicantName").fill("E2Eテスト建設株式会社");
  await page.locator("#landAreaSqm").fill("500");
  await page.locator("#nouchiKubun").selectOption("第3種農地");
  await page.locator("#hasSufficientFundsAndCredit").check();
  await page.locator("#hasConstructionSchedule").check();
  await page.locator("#hasNeighborDamagePreventionMeasures").check();

  await page.getByRole("button", { name: "要件判定＋書類サマリーを生成する" }).click();

  // /nouchi-tenyo/submit へのPOST後、結果画面（resultPage.js）へ遷移する。
  await expect(page.locator("h1")).toContainText("要件判定結果 — E2Eテスト建設株式会社");
  await expect(page.locator("h2")).toContainText(["判定レポート"]);
  // 生成された書類サマリー（docx）へのダウンロードリンクが最低1件表示される。
  await expect(page.locator('a[href*="/download/"]').first()).toBeVisible();
  // 「新しい申請者情報を入力する」リンクは建設業許可のフォーム（"/"）ではなく
  // 農地転用許可のフォーム（"/nouchi-tenyo"）へ戻る（resultPage.jsのformPathオプション）。
  await expect(page.getByRole("link", { name: "← 新しい申請者情報を入力する" })).toHaveAttribute("href", "/nouchi-tenyo");
});

test("農地転用許可インテイクフォーム: 資金調達区分の行を追加/削除できる", async ({ page }) => {
  await page.goto("/nouchi-tenyo");

  const rows = page.locator("#shikinChotatsuContainer .shikinChotatsu-row");
  await expect(rows).toHaveCount(0);

  await page.getByRole("button", { name: "＋ 資金調達区分を追加" }).click();
  await expect(rows).toHaveCount(1);

  await rows.first().getByRole("button", { name: "削除" }).click();
  await expect(rows).toHaveCount(0);
});

test("建設業許可インテイクフォームから農地転用許可インテイクフォームへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "→ 農地転用許可のインテイクフォームへ" }).click();
  await expect(page.locator("h1")).toHaveText("農地転用許可 申請者情報インテイク");
});
