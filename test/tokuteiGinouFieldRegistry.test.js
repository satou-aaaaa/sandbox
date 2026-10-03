import { test } from "node:test";
import assert from "node:assert/strict";
import { registerField, getField, listFields, clearFields } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.js";
import { SEED_FIELDS, seedFieldRegistry } from "../src/licenses/tokutei-ginou/eligibility/fieldRegistry.seed.js";

// ミューテーションテスト（#79）の対応方針: fieldRegistry.seed.jsは19分野分の
// 表示文言（fieldLabel・skillTestName・supplementaryNote）を列挙した静的データで、
// これらの文字列リテラルを個別に書き換えるミュータントの多くが生存する。
// 各分野の判定に実際に影響する項目（fieldKeyの一意性、
// requiresSectorSpecificJapaneseTest・supportsSpecifiedSkilled2の各フラグ）は
// 以下で個別に検証済み。表示文言そのものの逐語検証は、法令・公式資料との
// 整合性そのものを保証するものではない（運用前の出入国在留管理庁等の
// 公表資料での再確認は別途必要）が、タイプミス・意図しない上書きといった
// 改変を機械的に検知する目的では有効であり、ginouSuijun.js・
// nihongoNouryoku.jsのreasons/warningsに直接使われる実質的なデータである
// ことから、ADR-0011のCLI表示専用文言（判定結果に影響しない整形）とは
// 区別し、19分野全件を期待値と突き合わせるスナップショット的な検証を
// 下部に追加する。

test("getField: 未登録キーはundefinedを返す", () => {
  clearFields();
  assert.equal(getField("no-such-field"), undefined);
});

test("registerField・getField: 登録後に正しいエントリが取得できる", () => {
  clearFields();
  registerField({ fieldKey: "test-field", fieldLabel: "テスト分野", skillTestName: "テスト試験", requiresSectorSpecificJapaneseTest: false });
  const field = getField("test-field");
  assert.equal(field?.fieldLabel, "テスト分野");
});

test("listFields: 登録済み全件を返す", () => {
  clearFields();
  registerField({ fieldKey: "f1", fieldLabel: "分野1", skillTestName: "試験1", requiresSectorSpecificJapaneseTest: false });
  registerField({ fieldKey: "f2", fieldLabel: "分野2", skillTestName: "試験2", requiresSectorSpecificJapaneseTest: false });
  assert.equal(listFields().length, 2);
});

test("SEED_FIELDS: 19分野が定義されている（e-Gov法令検索で確認済み・2026年9月）", () => {
  assert.equal(SEED_FIELDS.length, 19);
});

test("SEED_FIELDS: 分野キーに重複がない", () => {
  const keys = SEED_FIELDS.map((f) => f.fieldKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("seedFieldRegistry: 呼び出し後、全19分野がgetFieldで取得できる", () => {
  clearFields();
  seedFieldRegistry();
  assert.equal(listFields().length, 19);
  for (const seed of SEED_FIELDS) {
    assert.equal(getField(seed.fieldKey)?.fieldLabel, seed.fieldLabel);
  }
});

test("SEED_FIELDS: 介護分野は分野固有の日本語試験が必要とされている", () => {
  const kaigo = SEED_FIELDS.find((f) => f.fieldKey === "kaigo");
  assert.equal(kaigo?.requiresSectorSpecificJapaneseTest, true);
});

test("SEED_FIELDS: 特定技能2号への移行対象分野は11分野（介護を除く。省令令和8年4月1日施行版で確認済み）", () => {
  const supported = SEED_FIELDS.filter((f) => f.supportsSpecifiedSkilled2);
  assert.equal(supported.length, 11);
  const supportedKeys = supported.map((f) => f.fieldKey).sort();
  assert.deepEqual(supportedKeys, [
    "biru-cleaning",
    "gaishokugyou",
    "gyogyou",
    "inshoku-ryouhin-seizougyou",
    "jidousha-seibi",
    "kensetsu",
    "kougyou-seihin-seizougyou",
    "koukuu",
    "nougyou",
    "shukuhaku",
    "zousen-hakuyou-kougyou",
  ]);
});

test("SEED_FIELDS: 介護分野は特定技能2号の対象外（在留資格「介護」への移行が想定されるため）", () => {
  const kaigo = SEED_FIELDS.find((f) => f.fieldKey === "kaigo");
  assert.equal(kaigo?.supportsSpecifiedSkilled2, undefined);
});

test("SEED_FIELDS: 2026年4月新設の3分野（林業・木材産業・資源循環）は特定技能2号の対象外", () => {
  for (const key of ["ringyou", "mokuzai-sangyou", "shigen-junkan"]) {
    const field = SEED_FIELDS.find((f) => f.fieldKey === key);
    assert.equal(field?.supportsSpecifiedSkilled2, undefined, `${key}は2号対象外のはず`);
  }
});

test("SEED_FIELDS: 19分野すべての内容が期待値と一致する（改変の検知）", () => {
  assert.deepEqual(SEED_FIELDS, [
    {
      fieldKey: "kaigo",
      fieldLabel: "介護",
      skillTestName: "介護技能評価試験",
      requiresSectorSpecificJapaneseTest: true,
      supplementaryNote: "分野固有の日本語試験として介護日本語評価試験の合格が別途必要（JLPT N4等とは別枠）。特定技能2号の対象外分野",
    },
    {
      fieldKey: "biru-cleaning",
      fieldLabel: "ビルクリーニング",
      skillTestName: "ビルクリーニング分野特定技能評価試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "linen-supply",
      fieldLabel: "リネンサプライ",
      skillTestName: "リネンサプライ分野特定技能1号技能測定試験（要最新確認）",
      requiresSectorSpecificJapaneseTest: false,
      supplementaryNote: "従来の「素形材・産業機械・電気電子情報関連製造業」等の一部から再編された分野。試験実施状況は要最新確認",
    },
    {
      fieldKey: "kougyou-seihin-seizougyou",
      fieldLabel: "工業製品製造業",
      skillTestName: "製造分野特定技能1号評価試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "従来の素形材・産業機械製造業/電気電子情報関連産業等が統合再編された分野（附則の経過措置対象）。特定技能2号への移行対象分野",
    },
    {
      fieldKey: "kensetsu",
      fieldLabel: "建設",
      skillTestName: "建設分野特定技能1号評価試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "受入れ機関側に建設特定技能受入計画の認定（国土交通大臣）等、分野固有の追加基準がある（9章の拡張ポイント参照）。特定技能2号への移行対象分野",
    },
    {
      fieldKey: "zousen-hakuyou-kougyou",
      fieldLabel: "造船・舶用工業",
      skillTestName: "造船・舶用工業分野特定技能1号試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "jidousha-seibi",
      fieldLabel: "自動車整備",
      skillTestName: "自動車整備分野特定技能評価試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "koukuu",
      fieldLabel: "航空",
      skillTestName: "航空分野技能評価試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "shukuhaku",
      fieldLabel: "宿泊",
      skillTestName: "宿泊業技能測定試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "jidousha-unsougyou",
      fieldLabel: "自動車運送業",
      skillTestName: "自動車運送業分野特定技能1号評価試験（要最新確認）",
      requiresSectorSpecificJapaneseTest: false,
      supplementaryNote: "比較的新しい分野（追加時期が16分野以降）のため試験実施状況は要最新確認",
    },
    {
      fieldKey: "tetsudou",
      fieldLabel: "鉄道",
      skillTestName: "鉄道分野特定技能1号評価試験",
      requiresSectorSpecificJapaneseTest: false,
    },
    {
      fieldKey: "butsuryu-souko",
      fieldLabel: "物流倉庫",
      skillTestName: "物流分野特定技能1号評価試験（要最新確認）",
      requiresSectorSpecificJapaneseTest: false,
      supplementaryNote: "比較的新しい分野のため試験実施状況は要最新確認",
    },
    {
      fieldKey: "nougyou",
      fieldLabel: "農業",
      skillTestName: "農業技能測定試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "gyogyou",
      fieldLabel: "漁業",
      skillTestName: "漁業技能測定試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "inshoku-ryouhin-seizougyou",
      fieldLabel: "飲食料品製造業",
      skillTestName: "飲食料品製造業技能測定試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "gaishokugyou",
      fieldLabel: "外食業",
      skillTestName: "外食業技能測定試験",
      requiresSectorSpecificJapaneseTest: false,
      supportsSpecifiedSkilled2: true,
      supplementaryNote: "特定技能2号への移行対象分野",
    },
    {
      fieldKey: "ringyou",
      fieldLabel: "林業",
      skillTestName: "林業技能測定試験（令和8年4月新設分野・要最新確認）",
      requiresSectorSpecificJapaneseTest: false,
      supplementaryNote: "令和8年4月1日の分野追加により新設。試験の実施団体・正式名称は実装直前に必ず再確認すること",
    },
    {
      fieldKey: "mokuzai-sangyou",
      fieldLabel: "木材産業",
      skillTestName: "木材産業技能測定試験（令和8年4月新設分野・要最新確認）",
      requiresSectorSpecificJapaneseTest: false,
      supplementaryNote: "令和8年4月1日の分野追加により新設。試験の実施団体・正式名称は実装直前に必ず再確認すること",
    },
    {
      fieldKey: "shigen-junkan",
      fieldLabel: "資源循環",
      skillTestName: "資源循環分野特定技能1号評価試験（令和8年4月新設分野・要最新確認）",
      requiresSectorSpecificJapaneseTest: false,
      supplementaryNote: "令和8年4月1日の分野追加により新設。試験の実施団体・正式名称は実装直前に必ず再確認すること",
    },
  ]);
});
