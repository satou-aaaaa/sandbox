# 設計書 — 在留資格「技術・人文知識・国際業務」申請支援モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_gijinkoku-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章を継承。本モジュールは在留期間が
「3月・1年・3年・5年」と可変である点で、これまでの固定期間型
（建設業許可・産廃許可の5年固定）とは異なる**「可変期間の有効期限型」**
という第四のリマインドパターンを実証する。コアの`ScheduleFn`契約
（`LicenseEntry`から`ScheduleItem[]`を返す）自体は変更せずに対応
できることを確認する（4.3節）。

加えて、要件定義書1.3節の制約（申請取次の届出）を踏まえ、**判定結果・
生成書類の文言に、他モジュール以上に強い一次スクリーニングの注記を
含める**ことを、コアの共通ヘルパーをそのまま使うのではなく本モジュール
専用の文言関数でラップする形で徹底する（4.2節）。

## 2. 全体アーキテクチャ

```
src/licenses/gijinkoku/
  eligibility/
    types.js
    gakureki.js        ← 学歴・実務経験要件
    hoshu.js             ← 報酬要件
    kanrensei.js          ← 専攻・職務関連性（自己申告＋警告のみ）
    engine.js
  documents/
    ninteiShinseisho.js   ← 在留資格認定証明書交付申請書サマリー
    checklist.js            ← 所属機関カテゴリー別 添付書類チェックリスト
  reminders/
    zairyuKikanSchedule.js  ← 可変期間の満了リマインド
  index.js
```

## 3. データモデル

```js
/**
 * @typedef {Object} GakurekiInput 学歴・実務経験要件の判定に使う入力。
 *   入管法基準省令（法別表第一の二の表・技術・人文知識・国際業務の項。
 *   e-Gov法令検索で原文確認済み・2026年9月）の項目一（自然科学・人文科学
 *   分野の技術・知識を要する業務）・項目二（外国の文化に基盤を有する
 *   思考・感受性を要する業務＝「国際業務」区分）で要件構造が異なる点に注意
 * @property {"大学卒業以上" | "専修学校専門課程修了" | "それ以外"} educationLevel
 * @property {number} [yearsOfRelevantExperience] 学歴要件・大学卒業免除のいずれも満たさない場合の、関連実務経験年数
 * @property {boolean} isInternationalServiceCategory 項目二（国際業務区分。通訳・翻訳・語学指導・広報・宣伝・海外取引業務・デザイン等）に該当するか。falseの場合は項目一（自然科学・人文科学分野の技術・知識を要する業務）として判定する
 * @property {boolean} [isTranslationInterpretationOrLanguageInstruction] 項目二のうち、特に通訳・翻訳・語学の指導の業務に従事するか（大学卒業者はこの業務に限り実務経験年数の要件が免除されるため区別する。基準省令別表第一の二の表・技術・人文知識・国際業務の項・二号ロただし書）
 */

/**
 * @typedef {Object} KanranseiInput 専攻・職務関連性の判定材料（機械判定はしない。FR-G1.3）
 * @property {string} majorOrExperienceField 専攻分野、または代替実務経験の分野の自由記述
 * @property {string} jobDescription 従事する職務内容の自由記述
 */

/**
 * @typedef {Object} HoshuInput 報酬要件の判定に使う入力
 * @property {number} offeredSalaryAnnual 提示する年収（円）
 * @property {number} comparableJapaneseSalaryAnnual 比較対象となる、同種業務に従事する日本人の年収水準（円）
 */

/**
 * @typedef {Object} GijinkokuApplicantProfile 申請の総合入力データ
 * @property {string} applicantName 外国人本人の氏名
 * @property {string} [nationality]
 * @property {string} companyName 所属機関（受入企業）名
 * @property {1 | 2 | 3 | 4} [companyCategory] 所属機関カテゴリー（法令ではなく行政上の運用要領に基づくため自動判定はせず、確定している場合のみ利用者が入力する。未確定の場合は省略可。要件定義書FR-G2.2参照）
 * @property {GakurekiInput} gakureki
 * @property {KanranseiInput} kanrensei
 * @property {HoshuInput} hoshu
 */
```

## 4. モジュール詳細設計

### 4.1 `eligibility/gakureki.js`・`hoshu.js`

```js
/**
 * @param {import('./types.js').GakurekiInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkGakureki(input) {
  const reasons = [];
  let passed = false;

  if (input.isInternationalServiceCategory) {
    // 項目二（国際業務区分）: 学歴要件そのものは無く、原則3年以上の実務経験が
    // 必要。ただし大学卒業者が通訳・翻訳・語学の指導に従事する場合のみ、
    // この3年要件が免除される（基準省令二号ロただし書）。他の国際業務
    // （広報・宣伝・海外取引業務・デザイン等）には学歴による免除は無く、
    // 大学を卒業していても3年の実務経験が必要な点に注意。
    if (input.educationLevel === "大学卒業以上" && input.isTranslationInterpretationOrLanguageInstruction) {
      passed = true;
      reasons.push("大学卒業者が通訳・翻訳・語学の指導に従事するため、実務経験要件は免除されます");
    } else {
      const requiredYears = 3;
      passed = (input.yearsOfRelevantExperience ?? 0) >= requiredYears;
      reasons.push(
        passed
          ? `実務経験 ${input.yearsOfRelevantExperience}年（${requiredYears}年以上）で要件を満たしています`
          : `実務経験が${requiredYears}年に達していません（国際業務区分に大学卒業による一律免除は無く、通訳・翻訳・語学の指導以外の業務では学歴に関わらず実務経験が必要です）`
      );
    }
  } else if (input.educationLevel === "大学卒業以上" || input.educationLevel === "専修学校専門課程修了") {
    // 項目一（自然科学・人文科学分野の技術・知識を要する業務）
    passed = true;
    reasons.push(`学歴要件（${input.educationLevel}）を満たしています`);
  } else {
    const requiredYears = 10; // 基準省令別表第一の二の表・技術・人文知識・国際業務の項・一号ハ（e-Gov法令検索で原文確認済み・2026年9月）
    passed = (input.yearsOfRelevantExperience ?? 0) >= requiredYears;
    reasons.push(
      passed
        ? `実務経験 ${input.yearsOfRelevantExperience}年（${requiredYears}年以上）で要件を満たしています`
        : `学歴要件を満たさず、実務経験も${requiredYears}年に達していません`
    );
  }
  return { key: "gakureki", label: "学歴・実務経験要件", passed, reasons, warnings: [] };
}

/**
 * @param {import('./types.js').HoshuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkHoshu(input) {
  const passed = input.offeredSalaryAnnual >= input.comparableJapaneseSalaryAnnual;
  return {
    key: "hoshu",
    label: "報酬要件（日本人と同等額以上）",
    passed,
    reasons: [
      passed
        ? `提示年収 ${input.offeredSalaryAnnual.toLocaleString()}円は比較水準（${input.comparableJapaneseSalaryAnnual.toLocaleString()}円）以上です`
        : `提示年収が比較水準を下回っています。給与条件の見直しが必要です`,
    ],
    warnings: [],
  };
}
```

`kanrensei.js`（専攻・職務関連性）は、要件定義書FR-G1.3の通り機械判定
せず、`KanranseiInput`（専攻分野・職務内容の自由記述）を受け取って
常に`passed: true`＋強い`warnings`（人手確認を促す文言）を返す、
建設業許可の`seijitsusei.js`と同型の実装とする。

**【スコープ外とした例外（法務大臣告示）】** 基準省令一号の柱書ただし書には、
情報処理技術に関する法務大臣告示指定の試験に合格し、又は指定の資格を
有する場合、項目一（自然科学・人文科学分野の技術・知識を要する業務）の
学歴・実務経験要件自体が免除される規定がある。ただし対象となる試験・
資格の一覧は法務大臣告示（e-Gov法令検索の対象外の行政文書）に定められて
おり、本フェーズでは一次資料による検証ができないため、`checkGakureki`
では実装しない（要件定義書FR-G1.2参照）。該当しうる申請者がいる場合は、
本ツールの判定結果によらず行政書士本人が個別に確認すること。

### 4.2 一次スクリーニングの強調文言（本モジュール専用）

```js
// src/licenses/gijinkoku/eligibility/disclaimer.js
export const GIJINKOKU_SCREENING_NOTICE =
  "※ この判定は書類準備段階での一次スクリーニングに過ぎません。" +
  "在留資格の該当性は、出入国在留管理局が個別の事案ごとに審査し、" +
  "本判定と異なる結果になることが十分にあります。また、この結果を" +
  "外国人本人・所属機関への在留資格取得の確約として提示しないこと。";
```

`formatChecksSection`（コア）で組み立てたレポート本文の先頭・末尾に
`GIJINKOKU_SCREENING_NOTICE`を付加する専用のフォーマット関数
（`formatGijinkokuEligibilityReport`）を用意し、他モジュールの
`formatEligibilityReport`をコピーせず、コアの共通部分＋本モジュール
固有の強調文言、という構成で実装する。docx出力（`ninteiShinseisho.js`）
側の`buildDisclaimerParagraph`の直後にも同文言の段落を追加する。

### 4.3 `reminders/zairyuKikanSchedule.js`（可変期間対応）

```js
/**
 * 在留期限日から、更新関連のリマインド日（満了90日前・60日前・30日前）を計算する。
 * 建設業許可のcalcRenewalScheduleと異なり、有効期間そのもの（3月/1年/3年/5年）を
 * 計算する必要はない（在留カードに記載された満了日を直接入力として受け取るため）。
 *
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 *   license.gijinkokuDetail.expiryDateIso（在留カード記載の満了日）を入力として使う
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcZairyuKikanSchedule(license) {
  const expiryDateIso = license.gijinkokuDetail?.expiryDateIso;
  if (!expiryDateIso) return [];
  return [
    { type: "zairyu-early-notice", label: "在留期間更新の早期検討（満了90日前）", dueDateIso: addDaysIso(expiryDateIso, -90) },
    { type: "zairyu-prepare", label: "更新申請の推奨開始日（満了60日前）", dueDateIso: addDaysIso(expiryDateIso, -60) },
    // 【法令確認済み・2026年9月】期限までに更新申請をすれば「処分がされる時、
    // 又は在留期間満了日から2ヶ月が経過する時」のいずれか早い時まで在留できる
    // 特例期間があるが、無期限ではない点をラベルで明示する（FR-G3.2）。
    { type: "zairyu-deadline", label: "更新申請の目安締切（満了30日前。特例期間は満了後2ヶ月までである点に注意）", dueDateIso: addDaysIso(expiryDateIso, -30) },
  ];
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const DAY_MS = 24 * 60 * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}
```

**設計上のポイント**: 建設業許可・産廃許可は「許可年月日」から満了日を
`calcRenewalSchedule`で「計算」していたのに対し、本モジュールは
「満了日そのもの」を入力として受け取る（在留期間が可変で、許可日から
一意に計算できないため）。この違いはコアの`ScheduleFn`契約
（`LicenseEntry`→`ScheduleItem[]`）の中に自然に収まり、コア側の
インターフェース変更は不要だった（`docs/DESIGN_kobutsu-core.md`で
設計したレジストリパターンの汎用性を裏付ける結果になっている）。

`LicenseEntry.gijinkokuDetail: { expiryDateIso?: string, periodType?: "3月" | "1年" | "3年" | "5年" }`
を追加する（`periodType`は表示用の参考情報。リマインド計算自体は
`expiryDateIso`のみを使う）。

### 4.4 `index.js`

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcZairyuKikanSchedule } from "./reminders/zairyuKikanSchedule.js";

export function registerGijinkokuModule() {
  registerScheduleFn("gijinkoku", calcZairyuKikanSchedule);
}
```

## 5. 実装ステップ

1. `eligibility/`（学歴→報酬→関連性→統合エンジン。1.3節の強調文言を
   最初から組み込む）
2. `documents/`（申請書サマリー→添付書類チェックリスト）
3. `reminders/`（満了リマインド→`index.js`登録）
4. 3月・1年・3年・5年、それぞれの在留期間でリマインドが正しく
   計算されることをCLIで確認

## 6. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `checkGakureki`: ①項目一（自然科学・人文科学分野）で学歴要件（大学卒業・
  専修学校専門課程修了）を満たす場合／10年の実務経験で代替する場合／
  どちらも満たさない場合、②項目二（国際業務区分）で大学卒業者が通訳・
  翻訳・語学の指導に従事し実務経験が免除される場合／その他の国際業務で
  大学卒業でも3年の実務経験が別途必要になる場合（免除の対象外である
  ことの確認）／3年の実務経験を満たす・満たさない場合
- `checkHoshu`: 提示年収が比較水準を上回る／同額／下回る、の境界値
- `calcZairyuKikanSchedule`: 在留期間3月・1年・3年・5年それぞれで
  満了日を設定した場合に、90日前・60日前・30日前のリマインドが
  正しく計算されること（短い期間〈3月〉の場合、満了90日前が
  在留開始前になってしまう等、境界ケースの扱いを明確にすること）
- `formatGijinkokuEligibilityReport`: 出力に必ず
  `GIJINKOKU_SCREENING_NOTICE`が含まれること（NFR-G2の担保）

## 7. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章を継承。加えて、外国人本人の個人情報
（旅券番号等）は`GijinkokuApplicantProfile`に含めない設計とした
（NFR-G1。書類生成に必要な範囲の情報のみを型に含める）。

## 8. 今後の拡張ポイント

- 在留資格変更許可申請（既に国内にいる外国人向け）への対応拡大
- 特定技能・技能実習等、他の在留資格への展開（本モジュールが
  「可変期間型」のリマインドパターンを実証したことで、期間の
  扱いが異なる在留資格にも同じ設計で対応できる見込みが高い）
- 所属機関カテゴリーの判定自体を入力ではなく規則ベースで自動判定する
  機能（本フェーズは`companyCategory`を手入力とし、自動判定は対象外）
