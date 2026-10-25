import { test, expect } from "@playwright/test";

/**
 * 飲食店営業許可インテイクフォームの実ブラウザ経由での疎通確認（E2E・golden path。#290）。
 * e2e/nouchi-tenyo-intake-form.spec.js と同じ位置づけ（要件の分岐網羅はユニットテストが担い、
 * ここでは入力→送信→結果画面、下書き保存→続きから入力の一連の操作が壊れていないかに限る）。
 */

test("飲食店営業許可インテイクフォーム: 申請者情報を入力して送信すると、判定結果画面が表示される", async ({ page }) => {
  await page.goto("/inshokuten-eigyo");
  await expect(page.locator("h1")).toHaveText("飲食店営業許可 申請者情報インテイク");

  await page.locator("#applicantName").fill("E2Eテスト食堂");
  await page.locator("#storeAddress").fill("東京都サンプル区1-1");
  await page.locator("#municipalityName").fill("東京都");
  await page.locator("#sinkCount").fill("2");
  await page.locator("#hasNonTouchHandwashing").check();
  await page.locator("#hasWashableWallFloorMaterial").check();
  await page.locator("#hasAdequateVentilation").check();
  await page.locator("#hasProperDrainage").check();
  await page.locator("#sekininshaName").fill("E2E花子");
  await page.locator("#qualificationType").selectOption("調理師");
  await page.locator("#isDesignatedPerStore").check();

  await page.getByRole("button", { name: "要件判定＋書類サマリーを生成する" }).click();

  await expect(page.locator("h1")).toContainText("要件判定結果 — E2Eテスト食堂");
  await expect(page.locator("h2")).toContainText(["判定レポート"]);
  await expect(page.locator('a[href*="/download/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "← 新しい申請者情報を入力する" })).toHaveAttribute("href", "/inshokuten-eigyo");
});

test("建設業許可インテイクフォームから飲食店営業許可インテイクフォームへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "→ 飲食店営業許可のインテイクフォームへ" }).click();
  await expect(page.locator("h1")).toHaveText("飲食店営業許可 申請者情報インテイク");
});

test("飲食店営業許可インテイクフォーム: 下書きとして保存→一覧→続きから入力で、入力値が復元される", async ({ page }) => {
  await page.goto("/inshokuten-eigyo");
  await page.locator("#applicantName").fill("下書きE2Eテスト食堂");
  await page.locator("#sinkCount").fill("3");
  await page.locator("#qualificationType").selectOption("栄養士");
  await page.locator("#usesTankOrWellWater").check();

  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();

  await page.goto("/drafts");
  const draftRow = page.locator("tr", { hasText: "下書きE2Eテスト食堂" });
  await expect(draftRow).toContainText("飲食店営業許可");

  await draftRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("飲食店営業許可 申請者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue("下書きE2Eテスト食堂");
  await expect(page.locator("#sinkCount")).toHaveValue("3");
  await expect(page.locator("#qualificationType")).toHaveValue("栄養士");
  await expect(page.locator("#usesTankOrWellWater")).toBeChecked();
});
