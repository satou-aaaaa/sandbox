/**
 * features/construction-kekkaku.feature のステップ定義。
 *
 * 判定ロジック自体は再実装せず、既存の`checkKekkaku`
 * （`test/eligibility.test.js`が単体テストする対象と同じ関数）を
 * そのまま呼び出す（CLAUDE.mdのコーディング規約「判定ロジックは
 * eligibility/rules/*.jsを再利用する」に沿う）。
 */
import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { checkKekkaku } from "../../src/licenses/construction/eligibility/rules/kekkaku.js";

Given("欠格事由に何も該当しない申請者がいる", function () {
  /** @type {import('../../src/licenses/construction/eligibility/types.js').KekkakuInput} */
  this.kekkakuInput = {
    isUndischargedBankrupt: false,
    hadLicenseRevokedWithin5Years: false,
    hasWithdrawnLicenseDuringRevocationHearingWithin5Years: false,
    hasBusinessSuspensionOrderInEffect: false,
    hasBusinessProhibitionOrderInEffect: false,
    hasCriminalRecordWithin5Years: false,
    isBoryokudanMemberOrWithin5Years: false,
    hasMentalImpairmentAffectingDuties: false,
    isControlledByBoryokudanMember: false,
    hasFalseOrOmittedStatement: false,
  };
});

Given("申請者は破産者で復権を得ていない", function () {
  this.kekkakuInput.isUndischargedBankrupt = true;
});

Given("申請者は5年以内に建設業許可を取り消された経験がある", function () {
  this.kekkakuInput.hadLicenseRevokedWithin5Years = true;
});

Given("申請者は許可取消しの聴聞通知後に駆け込み廃業してから5年を経過していない", function () {
  this.kekkakuInput.hasWithdrawnLicenseDuringRevocationHearingWithin5Years = true;
});

Given("申請者は営業停止命令の停止期間が経過していない", function () {
  this.kekkakuInput.hasBusinessSuspensionOrderInEffect = true;
});

Given("申請者は営業禁止処分の禁止期間が経過していない", function () {
  this.kekkakuInput.hasBusinessProhibitionOrderInEffect = true;
});

Given("申請者は拘禁刑以上の刑等から5年を経過していない", function () {
  this.kekkakuInput.hasCriminalRecordWithin5Years = true;
});

Given("申請者は暴力団員である、または脱退から5年を経過していない", function () {
  this.kekkakuInput.isBoryokudanMemberOrWithin5Years = true;
});

Given("申請者は心身の故障により建設業を適正に営むことができない", function () {
  this.kekkakuInput.hasMentalImpairmentAffectingDuties = true;
});

Given("暴力団員等が申請者の事業活動を実質的に支配している", function () {
  this.kekkakuInput.isControlledByBoryokudanMember = true;
});

Given("申請書類に虚偽記載または重要事実の記載漏れがある", function () {
  this.kekkakuInput.hasFalseOrOmittedStatement = true;
});

When("欠格要件を判定する", function () {
  this.result = checkKekkaku(this.kekkakuInput);
});

Then("判定結果は合格になる", function () {
  assert.equal(this.result.passed, true, this.result.reasons.join(" / "));
});

Then("判定結果は不合格になる", function () {
  assert.equal(this.result.passed, false);
});

Then("判定理由に{quoted}が含まれる", function (expectedSubstring) {
  assert.ok(
    this.result.reasons.some((r) => r.includes(expectedSubstring)),
    `判定理由に "${expectedSubstring}" を含む項目が見つかりません。実際の判定理由: ${this.result.reasons.join(" / ")}`
  );
});
