# 設計書 — 在留資格「特定技能」申請支援モジュール（1号）

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_tokutei-ginou-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`
前提となる第一弾（外国人材関連）設計: `docs/DESIGN_gijinkoku-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章（コアは許可種別を知らない・既存機能は
無傷で残す）、および`docs/DESIGN_gijinkoku-core.md`（可変期間の有効期限型
リマインド・一次スクリーニングの強調文言の専用ラップ）を継承する。

### gijinkoku-coreとの共通点

- コアの`ScheduleFn`契約（`LicenseEntry` → `ScheduleItem[]`）をそのまま
  利用する。在留期限を直接入力として受け取り満了リマインドを計算する
  「可変期間の有効期限型」パターンは、gijinkoku-coreで実証済みの設計を
  変更なく再利用する（4.4節）
- 判定結果・生成書類のすべてに、gijinkoku-coreと同等以上に強調した
  一次スクリーニングの注記を、コアの共通ヘルパーをラップする専用の
  文言関数で徹底する（`GIJINKOKU_SCREENING_NOTICE`と同型の
  `TOKUTEI_GINOU_SCREENING_NOTICE`を用意する。3.2節）
- 要件判定エンジンの構成（複数の`RequirementCheckResult`を
  `aggregateEligibility`で集約する）、書類生成の3関数パターン
  （`resolve<様式名>Rows` / `build<様式名>Document` /
  `write<様式名>Docx`）は、kobutsu-core・gijinkoku-coreと同一の構造を
  踏襲する

### gijinkoku-coreとの相違点（本モジュール固有の複雑性）

- gijinkoku-coreの要件判定は「学歴・報酬・関連性」という個人の属性の
  みを見る3要素だったのに対し、本モジュールは **(a) 本人の技能・日本語
  水準、(b) 受入れ機関（特定技能所属機関）自体の基準、(c) 支援計画の
  実施体制** という、対象の異なる3系統の判定軸を持つ。(b)(c)は
  「申請者本人」ではなく「受入れ機関」を判定対象とする点が、これまでの
  全モジュール（建設業許可の経営業務管理責任者等を除けば、基本的に
  個人の属性を見てきた）との明確な違いであり、`TokuteiGinouApplicantProfile`
  の型設計に反映する（3.3節）
- 分野（特定産業分野）ごとに技能評価試験・分野固有の日本語要件が
  異なるという「分野依存性」は、gijinkoku-coreの所属機関カテゴリー
  （1〜4の固定区分）よりも可変性が高い（分野数自体が改定されてきた
  実績がある）。kobutsu-coreの`prefectureRules.js`と同じ
  「レジストリパターン」を`fieldRegistry.js`として導入し、分野の
  追加・変更にコード変更を最小化する（4.1節）
- リマインドは「在留期限の満了」に加えて「**通算在留期間5年の上限**」
  という、gijinkoku-coreには存在しない第2のリマインド軸を持つ。
  `ScheduleFn`契約自体は変更せず、1回の`ScheduleFn`呼び出しが返す
  `ScheduleItem[]`に、満了リマインドと上限接近警告の両方を含める形で
  対応する（4.4節）。これにより「複数系統のリマインドを1つの
  `ScheduleFn`に混在させてよいか」という、これまで検証されていなかった
  ケースを扱う

## 2. 全体アーキテクチャ

```
src/licenses/tokutei-ginou/
  eligibility/
    types.js
    fieldRegistry.js        ← 特定産業分野ごとの試験名・分野固有要件フラグのレジストリ
    ginouSuijun.js             ← 技能水準（技能評価試験 or 技能実習2号良好修了）
    nihongoNouryoku.js           ← 日本語能力水準（JLPT N4 / JFT-Basic / 技能実習免除）
    shozokuKikanKijun.js           ← 特定技能所属機関の基準（労働法令遵守・報酬水準等）
    shienTaisei.js                    ← 支援体制（自社実施 or 登録支援機関委託）
    engine.js
  documents/
    ninteiShinseisho.js       ← 在留資格認定証明書交付申請書サマリー
    shienKeikakusho.js          ← 1号特定技能外国人支援計画書サマリー
    checklist.js                   ← 分野別 添付書類チェックリスト
  reminders/
    tokuteiGinouSchedule.js  ← 満了リマインド＋通算5年上限リマインド
  index.js
```

`fieldRegistry.js`は`docs/DESIGN_kobutsu-core.md`の
`prefectureRules.js`（都道府県ごとのルール登録・取得）と同じ設計思想の
モジュール内レジストリであり、コアの`scheduleTypes.js`（許可種別を
またぐレジストリ）とは別レイヤーである点に注意する（本モジュール内で
完結する、分野という一段細かい粒度のレジストリ）。

## 3. データモデル

### 3.1 分野レジストリの型（`eligibility/fieldRegistry.js`）

```js
/**
 * @typedef {Object} FieldRegistryEntry 特定産業分野1件分の登録情報
 * @property {string} fieldKey 分野キー（例: "kaigo", "kensetsu", "gaishokugyo"）
 * @property {string} fieldLabel 分野の表示名（例: "介護", "建設", "外食業"）
 * @property {string} skillTestName 標準的な技能評価試験名（分野により複数試験がある場合は代表例のみ）
 * @property {boolean} requiresSectorSpecificJapaneseTest
 *   分野固有の日本語試験が別途必要か（例: 介護分野の介護日本語評価試験）。
 *   trueの場合でも試験内容自体の判定ロジックは実装しない（フェーズ1スコープ外）
 * @property {string} [supplementaryNote] 分野固有の留意事項の自由記述（例: 受入れ人数上限の有無等）
 */

/** @type {Map<string, FieldRegistryEntry>} */
const registry = new Map();

/** @param {FieldRegistryEntry} entry */
export function registerField(entry) {
  registry.set(entry.fieldKey, entry);
}

/** @param {string} fieldKey @returns {FieldRegistryEntry | undefined} */
export function getField(fieldKey) {
  return registry.get(fieldKey);
}

/** @returns {FieldRegistryEntry[]} 登録済み全分野（表示用） */
export function listFields() {
  return [...registry.values()];
}
```

初期データ（19分野。**e-Gov法令検索で確認済み・2026年9月**:
「出入国管理及び難民認定法別表第一の二の表の特定技能の項の下欄に
規定する産業上の分野等を定める省令」〈平成三十一年法務省令第六号〉の
令和8年4月1日施行版で確認。当初の提案書は改定前の「16分野」のまま
だったため訂正した）は`registerField`の呼び出し列として別ファイル
（`fieldRegistry.seed.js`等）に持たせ、分野の追加・改定時はこの
初期データファイルのみを編集すればよい構造とする（`fieldRegistry.js`
本体のロジックは変更不要）。**初期データの試験名・分野固有要件フラグの
値は、実装前に出入国在留管理庁・分野所管省庁の公表資料で一次資料
確認すること**（`docs/REQUIREMENTS_tokutei-ginou-core.md` 6章参照。
kobutsu-coreの欠格事由号立てと同じ「実装前確認必須」の位置づけ）。

### 3.2 本人の技能・日本語要件の入力型（`eligibility/types.js`）

```js
/**
 * @typedef {Object} GinouShikenInput 技能水準の判定に使う入力
 * @property {string} fieldKey 対象の特定産業分野キー（fieldRegistryのキーと対応）
 * @property {boolean} hasPassedSkillTest 分野別の技能評価試験に合格しているか
 * @property {boolean} hasCompletedGinouJisshu2GoWell 技能実習2号を良好に修了しているか
 * @property {boolean} [isSameWorkCategoryAsGinouJisshu]
 *   技能実習2号修了により免除を主張する場合、修了した技能実習の作業区分と
 *   特定技能の業務区分が同一と考えられるか（自己申告。最終判断は人手確認）
 */

/**
 * @typedef {Object} NihongoNouryokuInput 日本語能力水準の判定に使う入力
 * @property {boolean} hasJlptN4OrAbove 日本語能力試験N4以上に合格しているか
 * @property {boolean} hasPassedJftBasic JFT-Basicに合格しているか
 * @property {boolean} isExemptByGinouJisshu2Go
 *   技能実習2号の良好な修了により日本語試験が免除される対象か
 *   （GinouShikenInput.hasCompletedGinouJisshu2GoWellと連動する入力だが、
 *   判定関数の独立性を保つため別フィールドとして持たせる。4.2節）
 */

/**
 * @typedef {Object} ShozokuKikanKijunInput 特定技能所属機関（受入れ機関）自体の基準判定に使う入力
 *   【注意】号立て・具体的な基準値は docs/REQUIREMENTS_tokutei-ginou-core.md
 *   6章の一次資料確認が完了してから確定すること。以下は要件定義書の
 *   暫定整理に基づく実装の出発点であり、確定仕様ではない。
 * @property {string} companyName 特定技能所属機関（受入れ企業）名
 * @property {boolean} noLaborLawViolationWithin5Years 過去5年以内に労働関係法令違反による処分を受けていないか
 * @property {boolean} noImmigrationLawViolationWithin5Years 過去5年以内に入管法令違反による処分を受けていないか
 * @property {number} offeredSalaryAnnual 提示する年収（円）
 * @property {number} comparableJapaneseSalaryAnnual 比較対象となる、同種業務に従事する日本人の年収水準（円）
 */

/**
 * @typedef {Object} ShienTaiseiInput 1号特定技能外国人支援計画の実施体制判定に使う入力
 * @property {"自社実施" | "全部委託" | "一部委託"} shienMethod 支援計画の実施方法
 * @property {boolean} [hasShienSekininsha] 自社実施・一部委託の場合、支援責任者を選任しているか
 * @property {boolean} [hasShienTantousha] 自社実施・一部委託の場合、支援担当者を選任しているか
 * @property {boolean} [hasStaffWithSodanExperience]
 *   過去2年以内に中長期在留者の生活相談業務に従事した経験がある者を配置しているか
 *   （自社実施の必須要件の一つ）
 * @property {boolean} [canSupportInUnderstandableLanguage] 外国人が理解できる言語での支援体制があるか
 * @property {string} [registeredSupportOrgName] 委託先の登録支援機関名（全部委託・一部委託の場合）
 * @property {boolean[]} mandatorySupportItemsCovered
 *   義務的支援10項目それぞれが計画に含まれているかのフラグ配列（長さ10固定。4.3節でラベルと対応付ける）
 */

/**
 * @typedef {Object} TokuteiGinouApplicantProfile 申請の総合入力データ
 * @property {string} applicantName 外国人本人の氏名
 * @property {string} [nationality]
 * @property {string} jobDescription 職務内容の自由記述
 * @property {GinouShikenInput} ginouShiken
 * @property {NihongoNouryokuInput} nihongoNouryoku
 * @property {ShozokuKikanKijunInput} shozokuKikanKijun
 * @property {ShienTaiseiInput} shienTaisei
 */
```

`ApplicantProfile`（建設業許可）・`KobutsuApplicantProfile`（古物商許可）
と同様、本モジュールも法人申請前提の受入れ機関情報を含むが、受入れ機関の
役員一覧等の詳細な法人情報までは持たない（フェーズ1は「判定に必要な
最小限の機関情報」に絞る。NFR-T1の踏襲）。

### 3.3 特定技能のクライアント側追加情報（`LicenseEntry.tokuteiGinouDetail`）

```js
/**
 * @typedef {Object} TokuteiGinouLicenseDetail LicenseEntry.tokuteiGinouDetail の中身
 * @property {string} fieldKey 対象の特定産業分野キー（fieldRegistryのキーと対応）
 * @property {string} [expiryDateIso] 在留カード記載の在留期限（YYYY-MM-DD）
 * @property {string} [cumulativeStayStartDateIso]
 *   通算在留期間の起算日（初回上陸日等）。5年上限の到達見込み日の計算に使う（4.4節）。
 *   起算日の正確な決定方法は一次資料確認が必要（docs/REQUIREMENTS_tokutei-ginou-core.md 6章）
 * @property {boolean} [supportOutsourced] 支援計画の委託有無（true: 全部または一部委託）
 * @property {string} [registeredSupportOrgName] 委託先の登録支援機関名（委託ありの場合）
 */
```

`LicenseEntry.licenseCategory`に`"tokutei-ginou"`を追加する
（`docs/DESIGN_kobutsu-core.md` 4.2節の型を次のように拡張する）。

```js
/**
 * @typedef {Object} LicenseEntry 許可1件分の情報（本開発で拡張。既存フィールドは無変更）
 * @property {string} licenseId
 * @property {"construction" | "kobutsu" | "gijinkoku" | "tokutei-ginou"} [licenseCategory]
 * @property {"一般" | "特定"} [licenseType]
 * @property {string} [grantDateIso]
 * @property {import('../../licenses/kobutsu/eligibility/types.js').KobutsuLicenseDetail} [kobutsuDetail]
 * @property {{ expiryDateIso?: string, periodType?: "3月" | "1年" | "3年" | "5年" }} [gijinkokuDetail]
 * @property {TokuteiGinouLicenseDetail} [tokuteiGinouDetail]
 */
```

## 4. モジュール詳細設計

### 4.1 `eligibility/ginouSuijun.js`（技能水準判定）

```js
import { getField } from "./fieldRegistry.js";

/**
 * 技能水準要件（分野別技能評価試験の合格、または技能実習2号の良好な修了）を判定する。
 * @param {import('./types.js').GinouShikenInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkGinouSuijun(input) {
  const field = getField(input.fieldKey);
  const fieldLabel = field?.fieldLabel ?? input.fieldKey;
  const reasons = [];
  const warnings = [];
  let passed = false;

  if (input.hasPassedSkillTest) {
    passed = true;
    reasons.push(`分野「${fieldLabel}」の技能評価試験（${field?.skillTestName ?? "分野別試験"}）に合格しています`);
  } else if (input.hasCompletedGinouJisshu2GoWell) {
    passed = true;
    reasons.push("技能実習2号を良好に修了しているため、技能水準要件は満たされているものとみなされます");
    if (input.isSameWorkCategoryAsGinouJisshu === false) {
      warnings.push("修了した技能実習の作業区分と特定技能の業務区分が同一でない可能性があります。移行の可否は個別に確認してください");
    } else if (input.isSameWorkCategoryAsGinouJisshu === undefined) {
      warnings.push("修了した技能実習の作業区分と特定技能の業務区分が同一区分内かどうか、必ず確認してください");
    }
  } else {
    reasons.push(`分野「${fieldLabel}」の技能評価試験に合格しておらず、技能実習2号の良好な修了もありません`);
  }

  if (field?.supplementaryNote) {
    warnings.push(`分野固有の留意事項: ${field.supplementaryNote}`);
  }

  return { key: "ginouSuijun", label: "技能水準要件", passed, reasons, warnings };
}
```

### 4.2 `eligibility/nihongoNouryoku.js`（日本語能力水準判定）

```js
import { getField } from "./fieldRegistry.js";

/**
 * 日本語能力水準要件（JLPT N4以上、JFT-Basic合格、または技能実習2号修了による免除）を判定する。
 * @param {import('./types.js').NihongoNouryokuInput} input
 * @param {string} fieldKey 分野固有の日本語試験要否を参照するために使う
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkNihongoNouryoku(input, fieldKey) {
  const reasons = [];
  const warnings = [];
  let passed = false;

  if (input.isExemptByGinouJisshu2Go) {
    passed = true;
    reasons.push("技能実習2号を良好に修了しているため、日本語試験は原則として免除されます");
  } else if (input.hasJlptN4OrAbove) {
    passed = true;
    reasons.push("日本語能力試験N4以上に合格しています");
  } else if (input.hasPassedJftBasic) {
    passed = true;
    reasons.push("JFT-Basic（国際交流基金日本語基礎テスト）に合格しています");
  } else {
    reasons.push("日本語能力試験N4以上・JFT-Basicのいずれの合格も確認できず、技能実習2号修了による免除にも該当しません");
  }

  const field = getField(fieldKey);
  if (passed && field?.requiresSectorSpecificJapaneseTest) {
    warnings.push(`分野「${field.fieldLabel}」では上記に加えて分野固有の日本語試験（例: 介護日本語評価試験）の合格が別途必要な場合があります。必ず確認してください`);
  }

  return { key: "nihongoNouryoku", label: "日本語能力水準要件", passed, reasons, warnings };
}
```

`GinouShikenInput.hasCompletedGinouJisshu2GoWell`と
`NihongoNouryokuInput.isExemptByGinouJisshu2Go`を別々の入力フィールドと
した理由: 技能実習2号修了は技能水準・日本語能力水準の双方に影響するが、
実務上まれに「技能実習の内容により技能水準は満たすが日本語能力水準の
免除は認められない」といった分野固有の例外が生じうるため、判定関数
（`ginouSuijun.js`・`nihongoNouryoku.js`）を疎結合に保ち、呼び出し側
（`engine.js`）が2つの入力を連動させるかどうかを決められるようにした
（フェーズ1では連動させて渡す想定だが、型としては独立させておく）。

### 4.3 `eligibility/shienTaisei.js`（支援体制チェック）

```js
const MANDATORY_SUPPORT_LABELS = [
  "事前ガイダンスの提供",
  "出入国時の送迎",
  "住居確保・生活契約支援",
  "生活オリエンテーションの実施",
  "公的手続への同行",
  "日本語学習機会の提供",
  "相談・苦情への対応",
  "日本人との交流促進",
  "転職支援（受入れ機関都合の離職時）",
  "定期的な面談・行政機関への通報",
];

/**
 * 1号特定技能外国人支援計画の実施体制を判定する。
 * 自社実施の場合は体制基準（支援責任者・支援担当者の選任、多言語対応、
 * 生活相談業務経験者の配置）を確認し、委託の場合は委託先の記録の有無を確認する。
 * 義務的支援10項目のカバー状況は判定結果と別に警告として出す。
 *
 * @param {import('./types.js').ShienTaiseiInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkShienTaisei(input) {
  const reasons = [];
  const warnings = [];
  let passed = true;

  if (input.shienMethod === "全部委託") {
    if (!input.registeredSupportOrgName) {
      passed = false;
      reasons.push("支援計画を全部委託する方針ですが、委託先の登録支援機関名が未記入です");
    } else {
      reasons.push(`支援計画は登録支援機関「${input.registeredSupportOrgName}」への全部委託により実施します`);
      warnings.push("委託先が出入国在留管理庁の登録支援機関として有効に登録されているか、発注者側で確認してください（本ツールでは確認しません）");
    }
  } else {
    // 自社実施・一部委託は、いずれも自社側の基準を満たす必要がある
    const selfChecks = [
      [input.hasShienSekininsha, "支援責任者が選任されていません"],
      [input.hasShienTantousha, "支援担当者が選任されていません"],
      [input.hasStaffWithSodanExperience, "過去2年以内に生活相談業務の経験がある者が配置されていません"],
      [input.canSupportInUnderstandableLanguage, "外国人が理解できる言語での支援体制が確認できていません"],
    ];
    for (const [ok, message] of selfChecks) {
      if (!ok) {
        passed = false;
        reasons.push(message);
      }
    }
    if (passed) {
      reasons.push(`自社基準を満たしており、支援計画を「${input.shienMethod}」により実施できます`);
    }
    if (input.shienMethod === "一部委託" && !input.registeredSupportOrgName) {
      warnings.push("一部委託の方針ですが、委託先の登録支援機関名が未記入です");
    }
  }

  const uncoveredCount = input.mandatorySupportItemsCovered.filter((covered) => !covered).length;
  if (uncoveredCount > 0) {
    input.mandatorySupportItemsCovered.forEach((covered, i) => {
      if (!covered) warnings.push(`義務的支援10項目のうち「${MANDATORY_SUPPORT_LABELS[i]}」が計画に含まれていません`);
    });
  }

  return { key: "shienTaisei", label: "支援計画の実施体制要件", passed, reasons, warnings };
}
```

`shozokuKikanKijun.js`（特定技能所属機関自体の基準）は、
`gijinkoku-core`の`checkHoshu`（報酬要件）と同型の比較ロジックに加え、
kobutsu-coreの`kekkaku.js`と同型のフラグ配列パターンを組み合わせた
構成とする（実装コードは省略。`ShozokuKikanKijunInput`のフィールドを
フラグ配列で回し、`offeredSalaryAnnual >= comparableJapaneseSalaryAnnual`
の比較を追加する）。

### 4.4 `reminders/tokuteiGinouSchedule.js`（満了リマインド＋通算5年上限）

```js
/**
 * 特定技能1号の在留期限満了リマインド、および通算在留期間5年上限の
 * 接近警告リマインドを算出する。gijinkoku-coreのcalcZairyuKikanSchedule
 * （満了日を直接入力として受け取る「可変期間の有効期限型」）を土台に、
 * 通算5年上限という第2のリマインド軸を同じScheduleItem[]に混在させる。
 * コアのScheduleFn契約（LicenseEntry → ScheduleItem[]）は変更しない。
 *
 * 【注意】通算在留期間の正確な計算方法（出国期間・特例期間の扱い、
 * 30日未満の端数の扱い）は docs/REQUIREMENTS_tokutei-ginou-core.md 6章の
 * 一次資料確認が完了してから確定すること。以下は簡易な暦月加算による
 * 近似計算であり、正確な計算が必要な個別ケースでは人手確認を促す。
 *
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcTokuteiGinouSchedule(license) {
  const detail = license.tokuteiGinouDetail;
  if (!detail) return [];

  const items = [];

  if (detail.expiryDateIso) {
    items.push(
      { type: "zairyu-early-notice", label: "在留期間更新の早期検討（満了90日前）", dueDateIso: addDaysIso(detail.expiryDateIso, -90) },
      { type: "zairyu-prepare", label: "更新申請の推奨開始日（満了60日前）", dueDateIso: addDaysIso(detail.expiryDateIso, -60) },
      { type: "zairyu-deadline", label: "更新申請の目安締切（満了30日前）", dueDateIso: addDaysIso(detail.expiryDateIso, -30) }
    );
  }

  if (detail.cumulativeStayStartDateIso) {
    const capDateIso = calcGonenJougenDate(detail.cumulativeStayStartDateIso);
    items.push({
      type: "gonen-jougen-keikoku",
      label: "通算在留期間5年上限の到達見込み日（簡易計算・特定技能2号移行等の検討要）",
      dueDateIso: addDaysIso(capDateIso, -180), // 上限180日前から警告を出す（早期の方針検討を促すための余裕）
    });
  }

  return items;
}

/**
 * 通算在留期間の起算日から、5年上限の到達見込み日を暦年加算で近似計算する。
 * @param {string} startDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcGonenJougenDate(startDateIso) {
  const [y, m, d] = startDateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y + 5, m - 1, d));
  return date.toISOString().slice(0, 10);
}

/**
 * 次回更新の候補期限が通算5年の上限を超えるかどうかを判定する（FR-T4.3）。
 * @param {string} cumulativeStayStartDateIso
 * @param {string} candidateNextExpiryDateIso
 * @returns {{ exceedsCap: boolean, capDateIso: string }}
 */
export function checkExceedsGonenJougen(cumulativeStayStartDateIso, candidateNextExpiryDateIso) {
  const capDateIso = calcGonenJougenDate(cumulativeStayStartDateIso);
  return { exceedsCap: candidateNextExpiryDateIso > capDateIso, capDateIso };
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const DAY_MS = 24 * 60 * 60 * 1000;
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}
```

**設計上のポイント**: `ScheduleFn`が1回の呼び出しで「満了リマインド」
「通算上限の接近警告」という異なる性質のリマインドを1つの配列に
混在させてよいかは、gijinkoku-coreの実装時点では検証されていなかった。
本モジュールの実装により、`ScheduleItem.type`で種別を区別しさえすれば
コア側（`digest.js`の`bucketizeAlerts`等）は無改修で複数系統の
リマインドを扱えることを確認する。もし将来、種別ごとに表示グループを
分けたい等の要望が出た場合は、`type`のプレフィックス規約（本モジュールは
`"zairyu-"`と`"gonen-jougen-"`で区別）をコア側の表示ロジックが利用する
拡張を9章で検討する。

## 5. `index.js`（コアへの登録）

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcTokuteiGinouSchedule } from "./reminders/tokuteiGinouSchedule.js";
import { registerField } from "./eligibility/fieldRegistry.js";
import { SEED_FIELDS } from "./eligibility/fieldRegistry.seed.js";

/**
 * 特定技能モジュールをコアへ登録する。gijinkoku-coreのregisterGijinkokuModuleと
 * 同じ役割。加えて、分野レジストリの初期データ投入もここで行う
 * （呼び出し忘れを防ぐため、分野レジストリのseedもindex.js側で一元管理する）。
 */
export function registerTokuteiGinouModule() {
  for (const entry of SEED_FIELDS) registerField(entry);
  registerScheduleFn("tokutei-ginou", calcTokuteiGinouSchedule);
}
```

CLIスクリプト・将来Webフォームを特定技能対応させる場合は、起動時に
`registerConstructionLicense()`・`registerKobutsuLicense()`・
`registerGijinkokuModule()`・`registerTokuteiGinouModule()`のすべてを
呼ぶこと（呼び忘れの検知については`docs/DESIGN_kobutsu-core.md` 8章の
起動時ログ出力の検討を参照）。

## 6. 実装ステップ

1. `eligibility/fieldRegistry.js`・`fieldRegistry.seed.js`
   （分野レジストリを先に用意し、以降のモジュールが参照できるようにする）
2. `eligibility/`（技能水準→日本語能力水準→所属機関基準→支援体制→
   統合エンジン。一次スクリーニングの強調文言を最初から組み込む）
3. `documents/`（認定証明書交付申請書サマリー→支援計画書サマリー→
   分野別添付書類チェックリスト）
4. `reminders/`（満了リマインド＋通算5年上限警告→`index.js`登録）
5. 分野レジストリの初期データ（19分野分）を、一次資料確認の結果に
   基づき`fieldRegistry.seed.js`へ投入する
6. 技能実習2号修了ケース／試験合格ケース双方で要件判定が正しく分岐する
   ことをCLIで確認し、通算在留期間の起算日を変えて上限到達見込み日が
   正しく計算されることを確認する

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章・`docs/DESIGN_gijinkoku-core.md` 6章を継承。追加観点:

- `checkGinouSuijun`: 技能評価試験に合格している場合／技能実習2号を
  良好に修了している場合（作業区分の関連性あり・なし・未入力の3通り）
  ／どちらも満たさない場合
- `checkNihongoNouryoku`: JLPT N4合格／JFT-Basic合格／技能実習2号修了に
  よる免除／いずれも満たさない場合。分野固有の日本語試験フラグが
  立っている分野で警告が出ること
- `checkShienTaisei`: 自社実施（基準充足／一部未充足の各パターン）・
  全部委託（委託先記入あり／なし）・一部委託（自社基準充足／未充足）の
  各組み合わせ。義務的支援10項目のうち一部が未カバーの場合に警告が
  10項目分正しく出ること
- `fieldRegistry.js`（レジストリ）: 未登録キーで`getField`が`undefined`
  を返すこと、登録後に正しいエントリが取れること（`scheduleTypes.js`の
  テスト観点を踏襲）
- `calcGonenJougenDate`: 起算日から5年後の日付が閏年をまたぐ場合を
  含めて正しく計算されること
- `checkExceedsGonenJougen`: 次回更新候補期限が上限を超える／超えない
  の境界値
- `calcTokuteiGinouSchedule`: `tokuteiGinouDetail`が未設定の場合に
  空配列を返すこと（回帰確認）。`expiryDateIso`のみ設定・
  `cumulativeStayStartDateIso`のみ設定・両方設定、の3パターンで
  正しい`ScheduleItem[]`が生成されること
- `digest.js`（コア）: `licenseCategory: "tokutei-ginou"`のレコードが
  他の許可種別（construction・kobutsu・gijinkoku）のリマインド生成に
  影響を与えないこと（回帰確認の要。`docs/DESIGN_kobutsu-core.md` 7章の
  回帰テスト方針を踏襲）
- 書類生成3モジュール: ダミーデータからdocxが生成でき、
  `TOKUTEI_GINOU_SCREENING_NOTICE`が含まれること

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章・`docs/DESIGN_gijinkoku-core.md` 7章を継承。加えて:

- 外国人本人の個人情報（技能実習の経歴・試験合格情報等）に加え、
  受入れ機関側の非公開情報（労働法令違反歴の有無等）も扱うため、
  `TokuteiGinouApplicantProfile`・`ShozokuKikanKijunInput`には
  書類生成に必要な範囲の情報のみを含める設計とした（NFR-T1）
- `fieldRegistry.seed.js`の初期データ（分野名・試験名）は、出入国在留
  管理庁・分野所管省庁の公表資料の改定を反映するメンテナンス対象で
  あることをコード冒頭のコメントに明記し、レビュー時に「最終確認日」
  を記録する運用とする（NFR-T3の担保）

## 9. 今後の拡張ポイント

- **特定技能2号への拡張**: **2026年9月実装済み**（案自体が想定していた
  設計方針どおり、`fieldRegistry.js`への`supportsSpecifiedSkilled2`
  フラグ追加＋`tokuteiGinouSchedule.js`の通算5年上限警告への案内文言
  追加で対応できた）。e-Gov法令検索で「出入国管理及び難民認定法別表
  第一の二の表の特定技能の項の下欄に規定する産業上の分野等を定める
  省令」（令和8年4月1日施行版）を確認したところ、2号の技能水準（熟練
  した技能）の対象は第2号・第4号〜第9号・第13号〜第16号の**11分野**
  （ビルクリーニング・工業製品製造業・建設・造船・舶用工業・自動車
  整備・航空・宿泊・農業・漁業・飲食料品製造業・外食業）に限定されて
  いることが判明した。介護分野は対象外（在留資格「介護」への移行が
  想定される）、比較的新しい分野（自動車運送業・鉄道・物流倉庫・
  林業・木材産業・資源循環）も現時点では2号の制度自体が未整備。
  この実装過程で、既存の`fieldRegistry.seed.js`の自由記述メモ
  （`supplementaryNote`）が、ビルクリーニング・工業製品製造業の2分野で
  「特定技能2号への移行対象分野」という記載を欠落させていた誤りを
  発見・修正した（他の9分野には正しく記載されていた）
- 分野固有の追加要件（介護日本語評価試験の内容判定、建設分野の建設
  特定技能受入計画認定手続支援等）を、`fieldRegistry.js`のエントリごとに
  追加の判定関数を紐づけられる形に拡張する
- 技能実習2号からの在留資格変更許可申請（国内で完結するケース）への
  対応拡大（要件定義書4.6節でフェーズ1スコープ外とした部分）
- 通算在留期間の正確な計算（出国期間・特例期間・端数処理）を、
  一次資料確認の結果を踏まえて`calcGonenJougenDate`の近似計算から
  精緻化する
- 登録支援機関としての支援実施・記録管理機能（本ツールキットの対象を
  拡張する場合の検討事項。1.3節で述べた通り、現時点では意図的に対象外
  としている）
