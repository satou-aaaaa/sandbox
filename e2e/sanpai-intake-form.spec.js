import { test, expect } from "@playwright/test";

/**
 * 産業廃棄物収集運搬業許可インテイクフォームの実ブラウザ経由での疎通確認（E2E・golden path。#291）。
 * e2e/inshokuten-eigyo-intake-form.spec.js と同じ位置づけ（要件の分岐網羅はユニットテストが担い、
 * ここでは入力→送信→結果画面、下書き保存→続きから入力の一連の操作が壊れていないかに限る）。
 */

test("産廃許可インテイクフォーム: 申請者情報を入力して送信すると、判定結果画面が表示される", async ({ page }) => {
  await page.goto("/sanpai");
  await expect(page.locator("h1")).toHaveText("産業廃棄物収集運搬業許可 申請者情報インテイク");

  await page.locator("#applicantName").fill("E2Eテスト運輸株式会社");
  await page.locator("#wasteTypes").fill("がれき類、木くず");
  await page.locator("#completionDateIso").fill("2024-04-01");
  await page.locator("#plannedApplicationDateIso").fill("2026-09-16");
  await page.locator("#latestNetAssets").fill("3000000");
  await page.locator("#hasOdorSpillPreventionMeasures").check();
  await page.locator(".vehicle-vehicleType").first().fill("4tダンプ");
  await page.locator(".vehicle-plateNumber").first().fill("サンプル100 あ 12-34");
  await page.locator(".vehicle-hasSpillPreventionMeasures").first().check();

  await page.getByRole("button", { name: "要件判定＋書類サマリーを生成する" }).click();

  await expect(page.locator("h1")).toContainText("要件判定結果 — E2Eテスト運輸株式会社");
  await expect(page.locator('a[href*="/download/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "← 新しい申請者情報を入力する" })).toHaveAttribute("href", "/sanpai");
});

test("建設業許可インテイクフォームから産廃許可インテイクフォームへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "→ 産業廃棄物収集運搬業許可のインテイクフォームへ" }).click();
  await expect(page.locator("h1")).toHaveText("産業廃棄物収集運搬業許可 申請者情報インテイク");
});

test("産廃許可インテイクフォーム: 下書きとして保存→一覧→続きから入力で、入力値が復元される", async ({ page }) => {
  // 手元ではサーバーと .e2e-tmp/drafts.json が使い回されるため、回ごとに別の名前にして行の取り違えを防ぐ。
  const draftName = `下書きE2Eテスト運輸-${Date.now()}`;
  await page.goto("/sanpai");
  await page.locator("#applicantName").fill(draftName);
  await page.locator("#isUndischargedBankrupt").check();
  await page.locator("#latestNetAssets").fill("-100");
  await page.locator(".vehicle-vehicleType").first().fill("2tパッカー車");

  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();

  await page.goto("/drafts");
  const draftRow = page.locator("tr", { hasText: draftName });
  await expect(draftRow).toContainText("産業廃棄物収集運搬業許可");

  await draftRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("産業廃棄物収集運搬業許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue(draftName);
  await expect(page.locator("#isUndischargedBankrupt")).toBeChecked();
  await expect(page.locator("#latestNetAssets")).toHaveValue("-100");
  await expect(page.locator(".vehicle-vehicleType").first()).toHaveValue("2tパッカー車");
});
