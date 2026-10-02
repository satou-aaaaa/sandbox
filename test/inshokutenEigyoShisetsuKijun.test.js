import { test } from "node:test";
import assert from "node:assert/strict";
import { checkShisetsuKijun } from "../src/licenses/inshokuten-eigyo/eligibility/shisetsuKijun.js";
import { buildSampleInshokutenEigyoProfile } from "../scripts/sampleInshokutenEigyoProfile.js";

test("checkShisetsuKijun: サンプルデータは全項目を満たしpassed=trueになる", () => {
  const result = checkShisetsuKijun(buildSampleInshokutenEigyoProfile().shisetsu);
  assert.equal(result.key, "shisetsuKijun");
  assert.equal(result.label, "施設基準（厨房・換気・給排水・手洗い設備等）");
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, ["施設基準の主要項目はすべて満たしています"]);
  assert.equal(result.warnings.length, 0);
});

test("checkShisetsuKijun: シンクが2槽未満ならpassed=falseになる", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.sinkCount = 1;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["シンクが2槽未満です（2槽以上が目安）"]);
});

test("checkShisetsuKijun: 手洗い設備が「ひねる水栓」構造ならpassed=falseになる", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.hasNonTouchHandwashing = false;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, [
    "手洗い設備が「洗浄後の手指の再汚染を防止できる構造」になっていません（ひねる水栓のみは不可）",
  ]);
});

test("checkShisetsuKijun: 床・壁・天井の材質が不適合ならpassed=falseになる", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.hasWashableWallFloorMaterial = false;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["床・壁・天井が耐水性・清掃しやすい材質になっていません"]);
});

test("checkShisetsuKijun: 換気設備が不足していればpassed=falseになる", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.hasAdequateVentilation = false;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["適切な換気設備が確認できません"]);
});

test("checkShisetsuKijun: 給排水設備が不足していればpassed=falseになる", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.hasProperDrainage = false;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.passed, false);
  assert.deepEqual(result.reasons, ["適切な給排水設備・グリストラップが確認できません"]);
});

test("checkShisetsuKijun: 貯水槽水・井戸水使用時に水質検査成績書が未準備なら警告が出るが合否には影響しない", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.usesTankOrWellWater = true;
  shisetsu.hasWaterQualityTestReport = false;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.passed, true);
  assert.deepEqual(result.warnings, ["貯水槽水・井戸水を使用するため、水質検査成績書の準備状況を確認してください"]);
});

test("checkShisetsuKijun: 貯水槽水・井戸水使用時に水質検査成績書が準備済みなら警告は出ない", () => {
  const shisetsu = buildSampleInshokutenEigyoProfile().shisetsu;
  shisetsu.usesTankOrWellWater = true;
  shisetsu.hasWaterQualityTestReport = true;
  const result = checkShisetsuKijun(shisetsu);
  assert.equal(result.warnings.length, 0);
});
