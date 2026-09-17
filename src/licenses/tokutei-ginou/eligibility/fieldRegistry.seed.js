/**
 * 特定産業分野レジストリの初期データ（19分野）。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】「出入国管理及び難民認定法別表
 * 第一の二の表の特定技能の項の下欄に規定する産業上の分野等を定める省令」
 * （平成三十一年法務省令第六号）の令和8年4月1日施行版で、分野の号立て・
 * 分野名を確認した（当初提案書の「16分野」という記述は誤りだったため
 * 訂正した。旧16分野に林業・木材産業・資源循環の3分野が追加され19分野に
 * なった経緯は`docs/DESIGN_tokutei-ginou-core.md`参照）。
 *
 * 【重要・メンテナンス対象】`skillTestName`（技能評価試験名）は法令上の
 * 名称ではなく、各分野の所管省庁・試験実施機関が定める運用上の名称で
 * あり、本ファイルの内容は法令（分野の号立て・分野名）ほどの一次資料
 * 確認を経ていない。特に令和8年4月1日追加の3分野（林業・木材産業・
 * 資源循環）は試験の実施実績が浅く、正式名称の変更・確定が生じうる。
 * 実運用前に出入国在留管理庁・分野所管省庁の最新の公表資料で必ず
 * 再確認すること（最終確認日: 2026年9月。NFR-T3）。
 */
import { registerField } from "./fieldRegistry.js";

/** @type {import('./fieldRegistry.js').FieldRegistryEntry[]} */
export const SEED_FIELDS = [
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
    supplementaryNote: "従来の素形材・産業機械製造業/電気電子情報関連産業等が統合再編された分野（附則の経過措置対象）",
  },
  {
    fieldKey: "kensetsu",
    fieldLabel: "建設",
    skillTestName: "建設分野特定技能1号評価試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "受入れ機関側に建設特定技能受入計画の認定（国土交通大臣）等、分野固有の追加基準がある（9章の拡張ポイント参照）。特定技能2号への移行対象分野",
  },
  {
    fieldKey: "zousen-hakuyou-kougyou",
    fieldLabel: "造船・舶用工業",
    skillTestName: "造船・舶用工業分野特定技能1号試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "特定技能2号への移行対象分野",
  },
  {
    fieldKey: "jidousha-seibi",
    fieldLabel: "自動車整備",
    skillTestName: "自動車整備分野特定技能評価試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "特定技能2号への移行対象分野",
  },
  {
    fieldKey: "koukuu",
    fieldLabel: "航空",
    skillTestName: "航空分野技能評価試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "特定技能2号への移行対象分野",
  },
  {
    fieldKey: "shukuhaku",
    fieldLabel: "宿泊",
    skillTestName: "宿泊業技能測定試験",
    requiresSectorSpecificJapaneseTest: false,
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
    supplementaryNote: "特定技能2号への移行対象分野",
  },
  {
    fieldKey: "gyogyou",
    fieldLabel: "漁業",
    skillTestName: "漁業技能測定試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "特定技能2号への移行対象分野",
  },
  {
    fieldKey: "inshoku-ryouhin-seizougyou",
    fieldLabel: "飲食料品製造業",
    skillTestName: "飲食料品製造業技能測定試験",
    requiresSectorSpecificJapaneseTest: false,
    supplementaryNote: "特定技能2号への移行対象分野",
  },
  {
    fieldKey: "gaishokugyou",
    fieldLabel: "外食業",
    skillTestName: "外食業技能測定試験",
    requiresSectorSpecificJapaneseTest: false,
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
];

/** 全19分野をレジストリへ登録する（`index.js`から呼ばれる）。 */
export function seedFieldRegistry() {
  for (const entry of SEED_FIELDS) registerField(entry);
}
