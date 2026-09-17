import { test } from "node:test";
import assert from "node:assert/strict";
import { checkKobutsuKekkaku } from "../src/licenses/kobutsu/eligibility/kekkaku.js";

/** @returns {import('../src/licenses/kobutsu/eligibility/types.js').KobutsuKekkakuInput} */
function cleanInput() {
  return {
    isUndischargedBankrupt: false,
    hasCriminalRecordWithin5Years: false,
    hasBoryokuFuhouKoiRisk: false,
    hasBoryokudanRelatedOrderWithin3Years: false,
    isAddressUnknown: false,
    hadLicenseRevokedWithin5Years: false,
    hasSurrenderedLicenseDuringRevocationHearingWithin5Years: false,
    hasMentalImpairmentAffectingDuties: false,
    isMinorWithoutCapacity: false,
  };
}

test("checkKobutsuKekkaku: 全項目該当なしなら合格する", () => {
  const result = checkKobutsuKekkaku(cleanInput());
  assert.equal(result.passed, true);
  assert.ok(result.reasons.some((r) => r.includes("該当する項目はありません")));
});

test("checkKobutsuKekkaku: 第一号（破産手続開始の決定を受けて復権を得ない者）に該当すれば不合格", () => {
  const input = { ...cleanInput(), isUndischargedBankrupt: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("破産")));
});

test("checkKobutsuKekkaku: 第二号（拘禁刑以上の刑等から5年を経過しない者）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasCriminalRecordWithin5Years: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("拘禁刑")));
});

test("checkKobutsuKekkaku: 第三号（集団的・常習的な暴力的不法行為等のおそれ）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasBoryokuFuhouKoiRisk: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("暴力的不法行為")));
});

test("checkKobutsuKekkaku: 第四号（暴力団関連の命令・指示を受け3年を経過しない者）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasBoryokudanRelatedOrderWithin3Years: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("暴力団関連の命令")));
});

test("checkKobutsuKekkaku: 第五号（住居の定まらない者）に該当すれば不合格", () => {
  const input = { ...cleanInput(), isAddressUnknown: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("住居")));
});

test("checkKobutsuKekkaku: 第六号（許可取消しから5年を経過しない者）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hadLicenseRevokedWithin5Years: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("許可の取消し")));
});

test("checkKobutsuKekkaku: 第七号（取消しの聴聞公示後に許可証を返納した者）に該当すれば不合格（第六号とは別の独立した欠格事由）", () => {
  const input = { ...cleanInput(), hasSurrenderedLicenseDuringRevocationHearingWithin5Years: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("聴聞公示後")));
});

test("checkKobutsuKekkaku: 第八号（心身の故障により業務を適正に実施できない者）に該当すれば不合格", () => {
  const input = { ...cleanInput(), hasMentalImpairmentAffectingDuties: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("心身の故障")));
});

test("checkKobutsuKekkaku: 第九号（未成年者）に該当し例外規定にも該当しなければ不合格", () => {
  const input = { ...cleanInput(), isMinorWithoutCapacity: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("未成年者")));
});

test("checkKobutsuKekkaku: 第九号に該当しても相続人としての例外規定に該当すれば合格する", () => {
  const input = {
    ...cleanInput(),
    isMinorWithoutCapacity: true,
    isHeirWithQualifiedLegalRepresentative: true,
  };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, true);
});

test("checkKobutsuKekkaku: 複数の欠格事由に同時に該当する場合はすべて理由に含まれる", () => {
  const input = { ...cleanInput(), isUndischargedBankrupt: true, isAddressUnknown: true };
  const result = checkKobutsuKekkaku(input);
  assert.equal(result.passed, false);
  assert.equal(result.reasons.length, 2);
});

/** @returns {import('../src/licenses/kobutsu/eligibility/types.js').KobutsuOfficerInput} */
function cleanOfficer(name) {
  return {
    name,
    isUndischargedBankrupt: false,
    hasCriminalRecordWithin5Years: false,
    hasBoryokuFuhouKoiRisk: false,
    hasBoryokudanRelatedOrderWithin3Years: false,
    isAddressUnknown: false,
    hadLicenseRevokedWithin5Years: false,
    hasSurrenderedLicenseDuringRevocationHearingWithin5Years: false,
    hasMentalImpairmentAffectingDuties: false,
  };
}

test("checkKobutsuKekkaku: 法人申請で役員全員が欠格事由に該当しなければ合格する（第十一号）", () => {
  const result = checkKobutsuKekkaku(cleanInput(), [cleanOfficer("役員A"), cleanOfficer("役員B")]);
  assert.equal(result.passed, true);
});

test("checkKobutsuKekkaku: 法人申請で役員の1人が欠格事由（破産）に該当すれば不合格になる（第十一号）", () => {
  const officers = [cleanOfficer("役員A"), { ...cleanOfficer("役員B"), isUndischargedBankrupt: true }];
  const result = checkKobutsuKekkaku(cleanInput(), officers);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.includes("役員（役員B）") && r.includes("破産") && r.includes("第十一号")));
});

test("checkKobutsuKekkaku: 申請者本人は欠格事由に該当しなくても役員が該当すれば不合格になる（第十一号）", () => {
  const officers = [{ ...cleanOfficer("役員C"), hasBoryokudanRelatedOrderWithin3Years: true }];
  const result = checkKobutsuKekkaku(cleanInput(), officers);
  assert.equal(result.passed, false);
});

test("checkKobutsuKekkaku: officers未指定（個人申請）の場合は従来どおり本人のみで判定する", () => {
  const result = checkKobutsuKekkaku(cleanInput());
  assert.equal(result.passed, true);
  assert.equal(result.reasons.length, 1);
});

test("checkKobutsuKekkaku: 複数の役員がそれぞれ別の欠格事由に該当する場合、両方が理由に含まれる", () => {
  const officers = [
    { ...cleanOfficer("役員D"), isAddressUnknown: true },
    { ...cleanOfficer("役員E"), hasMentalImpairmentAffectingDuties: true },
  ];
  const result = checkKobutsuKekkaku(cleanInput(), officers);
  assert.equal(result.passed, false);
  assert.equal(result.reasons.length, 2);
  assert.ok(result.reasons.some((r) => r.includes("役員D")));
  assert.ok(result.reasons.some((r) => r.includes("役員E")));
});
