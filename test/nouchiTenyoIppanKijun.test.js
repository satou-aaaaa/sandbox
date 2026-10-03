import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIppanKijun } from "../src/licenses/nouchi-tenyo/eligibility/ippanKijun.js";

function completeInput() {
  return { hasSufficientFundsAndCredit: true, hasConstructionSchedule: true, hasNeighborDamagePreventionMeasures: true, hasNeighborConsent: true };
}

test("checkIppanKijun: すべて満たせば合格", () => {
  const result = checkIppanKijun(completeInput());
  assert.equal(result.passed, true);
  assert.equal(result.key, "ippanKijun");
  assert.equal(result.label, "一般基準（転用の確実性・周辺農地への配慮）");
  assert.deepEqual(result.reasons, ["一般基準（転用の確実性・周辺農地への被害防除措置）を満たしています"]);
  assert.deepEqual(result.warnings, []);
});

test("checkIppanKijun: 資力・信用が無ければ不合格で、満たしている旨の文言は出ない", () => {
  const result = checkIppanKijun({ ...completeInput(), hasSufficientFundsAndCredit: false });
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes("転用を確実に行うための資力・信用が確認できていません（融資内諾書・自己資金証明等の提出が必要です）"));
  assert.ok(!result.reasons.includes("一般基準（転用の確実性・周辺農地への被害防除措置）を満たしています"));
});

test("checkIppanKijun: 工事計画が無ければ不合格", () => {
  const result = checkIppanKijun({ ...completeInput(), hasConstructionSchedule: false });
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes("工事計画・工程表が具体的に定まっていません"));
});

test("checkIppanKijun: 被害防除措置が無ければ不合格", () => {
  const result = checkIppanKijun({ ...completeInput(), hasNeighborDamagePreventionMeasures: false });
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes("周辺農地への被害防除措置（排水計画等）が確認できていません"));
});

test("checkIppanKijun: 隣接同意が未取得でも合否には影響しないが警告が出る", () => {
  const result = checkIppanKijun({ ...completeInput(), hasNeighborConsent: false });
  assert.equal(result.passed, true);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0], "隣接農地所有者等の同意書の要否は都道府県・農業委員会の運用によって異なります。必ず事前相談で確認してください");
});
