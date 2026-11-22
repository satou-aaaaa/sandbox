import { test, expect } from "@playwright/test";

/**
 * 住宅宿泊事業（民泊）届出インテイクフォームの実ブラウザ経由での疎通確認（E2E・golden path。#292）。
 * e2e/sanpai-intake-form.spec.js と同じ位置づけ（要件の分岐網羅はユニットテストが担い、
 * ここでは入力→送信→結果画面、下書き保存→続きから入力の一連の操作が壊れていないかに限る）。
 */

test("民泊届出インテイクフォーム: 届出者情報を入力して送信すると、結果画面が表示される", async ({ page }) => {
  await page.goto("/minpaku");
  await expect(page.locator("h1")).toHaveText("住宅宿泊事業（民泊）届出 届出者情報インテイク");

  await page.locator("#applicantName").fill("E2Eテスト 花子");
  await page.locator("#propertyAddress").fill("サンプル県サンプル市1-1-1");
  for (const checkbox of await page.locator(".document-obtained").all()) await checkbox.check();

  await page.getByRole("button", { name: "準備状況の確認＋書類サマリーを生成する" }).click();

  await expect(page.locator("h1")).toContainText("要件判定結果 — E2Eテスト 花子");
  await expect(page.locator('a[href*="/download/"]').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "← 新しい申請者情報を入力する" })).toHaveAttribute("href", "/minpaku");
});

test("建設業許可インテイクフォームから民泊届出インテイクフォームへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "→ 住宅宿泊事業（民泊）届出のインテイクフォームへ" }).click();
  await expect(page.locator("h1")).toHaveText("住宅宿泊事業（民泊）届出 届出者情報インテイク");
});

test("民泊届出インテイクフォーム: 下書きとして保存→一覧→続きから入力で、入力値が復元される", async ({ page }) => {
  // 手元ではサーバーと .e2e-tmp/drafts.json が使い回されるため、回ごとに別の名前にして行の取り違えを防ぐ。
  const draftName = `下書きE2E民泊-${Date.now()}`;
  await page.goto("/minpaku");
  await page.locator("#applicantName").fill(draftName);
  await page.locator("#residentType").selectOption("家主不在型");
  await page.locator("#isUndischargedBankrupt").check();
  await page.locator(".document-obtained").first().check();

  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page.locator(".saved-notice")).toBeVisible();

  await page.goto("/drafts");
  const draftRow = page.locator("tr", { hasText: draftName });
  await expect(draftRow).toContainText("住宅宿泊事業（民泊）届出");

  await draftRow.getByRole("link", { name: "続きから入力" }).click();
  await expect(page.locator("h1")).toHaveText("住宅宿泊事業（民泊）届出 届出者情報インテイク");
  await expect(page.locator("#applicantName")).toHaveValue(draftName);
  await expect(page.locator("#residentType")).toHaveValue("家主不在型");
  await expect(page.locator("#isUndischargedBankrupt")).toBeChecked();
  await expect(page.locator(".document-obtained").first()).toBeChecked();
});
