// 【等価ミュータント】switch文の "農用地区域内農地"/"甲種農地"/"第1種農地" の
// 3ケースはdefaultと同一ブロックへフォールスルーする設計（いずれも「原則不許可
// グループ」として同じ判定ロジックを共有する）。そのため、これらのcase値を
// 空文字列に置き換えるミュータントは、どの入力に対しても出力を変えない
// （元々どの入力も最終的に同じブロックへ到達するため）。テスト追加では
// 検知できない等価ミュータントと判断し、対応を見送る（ADR-0011の方針）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRicchiKijun } from "../src/licenses/nouchi-tenyo/eligibility/ricchiKijun.js";

test("checkRicchiKijun: 第3種農地は原則許可（合格）", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第3種農地" });
  assert.equal(result.passed, true);
  assert.equal(result.key, "ricchiKijun");
  assert.equal(result.label, "立地基準（農地区分に基づく許可の可否）");
  assert.deepEqual(result.reasons, ["第3種農地は原則許可の対象です"]);
});

test("checkRicchiKijun: 第2種農地は代替地が無ければ合格", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第2種農地", hasNoAlternativeLand: true });
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["第2種農地であり、周辺に代替可能な土地が無いため許可の対象となり得ます"]);
  assert.deepEqual(result.warnings, ["代替地の有無の認定は農業委員会・都道府県の審査に委ねられます。本判定は自己申告に基づく形式的な一次判定です"]);
});

test("checkRicchiKijun: 第2種農地は代替地があれば不合格", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第2種農地", hasNoAlternativeLand: false });
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["第2種農地です。周辺に代替可能な土地がある場合は原則不許可となります"]);
});

test("checkRicchiKijun: 農用地区域内農地は例外事由が無ければ不合格", () => {
  const result = checkRicchiKijun({ nouchiKubun: "農用地区域内農地" });
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["農用地区域内農地は原則不許可です（農用地区域内農地の場合は転用許可の前に農振除外の手続が別途必要です）"]);
  assert.deepEqual(result.warnings, ["農地区分の最終認定・例外規定への該当可否は農業委員会・都道府県の審査で決まります。必ず事前相談で確認してください"]);
});

test("checkRicchiKijun: 甲種農地は例外事由があれば合格するが、一次判定である旨の警告が必ず付く", () => {
  const result = checkRicchiKijun({ nouchiKubun: "甲種農地", hasExceptionReason: true, exceptionReasonNote: "土地改良事業の施行区域除外予定" });
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("農業委員会"));
  assert.deepEqual(result.reasons, ["甲種農地は原則不許可ですが、申告された例外事由（土地改良事業の施行区域除外予定）に該当する可能性があります"]);
});

test("checkRicchiKijun: 甲種農地は例外事由の具体的な記載が無ければ「詳細未記入」で案内される", () => {
  const result = checkRicchiKijun({ nouchiKubun: "甲種農地", hasExceptionReason: true });
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["甲種農地は原則不許可ですが、申告された例外事由（詳細未記入）に該当する可能性があります"]);
});

test("checkRicchiKijun: 第1種農地も原則不許可のグループとして扱われる", () => {
  const result = checkRicchiKijun({ nouchiKubun: "第1種農地" });
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["第1種農地は原則不許可です（農用地区域内農地の場合は転用許可の前に農振除外の手続が別途必要です）"]);
});

test("checkRicchiKijun: 第3種農地・第2種農地でも警告なしにはならない（第2種は警告あり、第3種は警告なしの想定）", () => {
  assert.equal(checkRicchiKijun({ nouchiKubun: "第3種農地" }).warnings.length, 0);
  assert.equal(checkRicchiKijun({ nouchiKubun: "第2種農地", hasNoAlternativeLand: true }).warnings.length, 1);
});
