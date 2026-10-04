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

/**
 * 下書き機能のE2E（Issue #228）。建設業許可のe2e/intake-form.spec.jsでは
 * 「保存→一覧に表示される」までしか確認していなかったが、#73（PR #189）で
 * `DraftRecord.licenseCategory`による種別判別が入ったため、古物商許可・
 * 農地転用許可でも「続きから入力」で正しい種別のフォームが開き、配列行
 * （営業所等）を含めて値が復元されることを実ブラウザで確認する
 * （種別の取り違えはユニットテストでは気づきにくいため）。
 */
test("古物商許可インテイクフォーム: 下書きとして保存→一覧→続きから入力で、営業所の行を含めて入力値が復元される", async ({ page }) => {
  await page.goto("/kobutsu");
  await page.locator("#applicantName").fill("下書きE2Eテスト古物商");
  await page.locator("#address").fill("東京都サンプル区9-9-9");

  const eigyoshoRows = page.locator("#eigyoshoContainer .eigyosho-row");
  await eigyoshoRows.first().locator(".eigyosho-officeName").fill("下書き営業所");
  await eigyoshoRows.first().locator(".eigyosho-managerName").fill("下書き管理者");

  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();
  await expect(page.locator("#applicantName")).toHaveValue("下書きE2Eテスト古物商");

  // 保存した下書きが、古物商許可の種別つきで一覧画面に表示される。
  await page.goto("/drafts");
  const draftRow = page.locator("tr", { hasText: "下書きE2Eテスト古物商" });
  await expect(draftRow).toContainText("古物商許可");

  // 「続きから入力」で古物商許可のフォームに戻り、営業所の行を含めて値が復元される。
  await draftRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("古物商許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue("下書きE2Eテスト古物商");
  await expect(page.locator("#address")).toHaveValue("東京都サンプル区9-9-9");
  await expect(eigyoshoRows).toHaveCount(1);
  await expect(eigyoshoRows.first().locator(".eigyosho-officeName")).toHaveValue("下書き営業所");
  await expect(eigyoshoRows.first().locator(".eigyosho-managerName")).toHaveValue("下書き管理者");
});

test("下書き一覧: 建設業・古物商・農地転用の下書きが混在していても、各「続きから入力」が自分の種別のフォームを開き、削除も他の種別の下書きに影響しない", async ({
  page,
}) => {
  // 他のE2Eテスト（並行実行）が保存した下書きと混同しないよう、実行ごとに一意な接尾辞を付ける。
  const suffix = `混在${Date.now()}`;
  const constructionName = `建設${suffix}`;
  const kobutsuName = `古物商${suffix}`;
  const nouchiName = `農地${suffix}`;

  await page.goto("/");
  await page.locator("#applicantName").fill(constructionName);
  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();

  await page.goto("/kobutsu");
  await page.locator("#applicantName").fill(kobutsuName);
  await page.locator("#eigyoshoContainer .eigyosho-row").first().locator(".eigyosho-officeName").fill("混在営業所");
  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();

  await page.goto("/nouchi-tenyo");
  await page.locator("#applicantName").fill(nouchiName);
  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();

  await page.goto("/drafts");
  const constructionRow = page.locator("tr", { hasText: constructionName });
  const kobutsuRow = page.locator("tr", { hasText: kobutsuName });
  const nouchiRow = page.locator("tr", { hasText: nouchiName });
  await expect(constructionRow).toContainText("建設業許可");
  await expect(kobutsuRow).toContainText("古物商許可");
  await expect(nouchiRow).toContainText("農地転用許可");

  // 古物商許可の「続きから入力」は古物商許可のフォーム（他種別ではない）を開く。
  await kobutsuRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("古物商許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue(kobutsuName);
  await expect(page.locator("#eigyoshoContainer .eigyosho-row").first().locator(".eigyosho-officeName")).toHaveValue(
    "混在営業所"
  );

  // 農地転用許可の「続きから入力」は農地転用許可のフォームを開く。
  await page.goto("/drafts");
  await nouchiRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("農地転用許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue(nouchiName);

  // 建設業許可の「続きから入力」は建設業許可のフォームを開く。
  await page.goto("/drafts");
  await constructionRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("建設業許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue(constructionName);

  // 古物商許可の下書きを削除しても、建設業許可・農地転用許可の下書きは残る。
  await page.goto("/drafts");
  page.once("dialog", (dialog) => dialog.accept());
  await kobutsuRow.getByRole("button", { name: "削除" }).click();
  await expect(page.locator("table")).not.toContainText(kobutsuName);
  await expect(page.locator("table")).toContainText(constructionName);
  await expect(page.locator("table")).toContainText(nouchiName);
});
