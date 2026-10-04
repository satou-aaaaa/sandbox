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

/**
 * 下書き機能のE2E（Issue #228）。古物商許可のe2e/kobutsu-intake-form.spec.jsと
 * 同じ位置づけ。農地転用許可でも「続きから入力」で自分の種別のフォームが開き、
 * 配列行（資金調達内訳）を含めて値が復元されることを実ブラウザで確認する。
 * 種別混在時の挙動（他種別を取り違えない・削除が他種別に影響しない）は
 * e2e/kobutsu-intake-form.spec.jsに1テストとして追加済み。
 */
test("農地転用許可インテイクフォーム: 下書きとして保存→一覧→続きから入力で、資金調達内訳の行を含めて入力値が復元される", async ({
  page,
}) => {
  await page.goto("/nouchi-tenyo");
  await page.locator("#applicantName").fill("下書きE2Eテスト農地");
  await page.locator("#landAreaSqm").fill("300");

  await page.getByRole("button", { name: "＋ 資金調達区分を追加" }).click();
  const rows = page.locator("#shikinChotatsuContainer .shikinChotatsu-row");
  await rows.first().locator(".shikinChotatsu-kubun").fill("自己資金");
  await rows.first().locator(".shikinChotatsu-amountYen").fill("1000000");

  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();
  await expect(page.locator("#applicantName")).toHaveValue("下書きE2Eテスト農地");

  // 保存した下書きが、農地転用許可の種別つきで一覧画面に表示される。
  await page.goto("/drafts");
  const draftRow = page.locator("tr", { hasText: "下書きE2Eテスト農地" });
  await expect(draftRow).toContainText("農地転用許可");

  // 「続きから入力」で農地転用許可のフォームに戻り、資金調達内訳の行を含めて値が復元される。
  await draftRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("農地転用許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue("下書きE2Eテスト農地");
  await expect(page.locator("#landAreaSqm")).toHaveValue("300");
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator(".shikinChotatsu-kubun")).toHaveValue("自己資金");
  await expect(rows.first().locator(".shikinChotatsu-amountYen")).toHaveValue("1000000");
});
