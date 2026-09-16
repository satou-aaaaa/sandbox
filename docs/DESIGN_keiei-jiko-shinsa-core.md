# 設計書 — 経営事項審査（経審）申請支援モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_keiei-jiko-shinsa-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章の2原則（コアは許可種別を知らない／
既存機能は無傷で残す）をそのまま継承する。本モジュールはこれまでの
5モジュール（古物商許可・産廃許可・民泊届出・在留資格支援・BtoB下請け
ポータル）と異なり、**既存の建設業許可クライアントとの連携そのものが
要件の中心**にあるため、追加で2つの設計原則を置く。

- **「許可種別を知らないコア」と「クライアントレコードを横断する
  アドオン」は別の話である**: コア（`src/core/`）が許可種別を知らない
  という原則（`docs/DESIGN_kobutsu-core.md`）は変えない。一方で、
  経審アドオン自身（`src/licenses/keiei-jiko-shinsa/`）は、
  同一`ClientRecord`内の**他の`LicenseEntry`（`licenseCategory:
  "construction"`）を読む**ことを前提にしてよい。これは許可種別を
  横断する初めてのアドオン間連携であり、コア側の型・関数
  （`ClientRecord`・`LicenseEntry`・`upsertClientLicense`等）を一切
  変更せずに実現できることを検証する（4.4節）
- **点数計算はしない。準備状況の可視化と期限管理に徹する**: 経審の
  評点（X1〜W・総合評定値P）の計算式は法令・告示に基づく精密なものであり、
  誤った実装は顧客の公共工事入札に直接影響しうる。本モジュールは
  「入力データが揃っているかの形式チェック」「書類サマリーの生成」
  「有効期限が切れないようにするリマインド」の3点に機能を絞り、
  評点計算そのものには踏み込まない（要件定義書1.3節）

## 2. 全体アーキテクチャ

```
src/licenses/keiei-jiko-shinsa/
  eligibility/
    types.js
    prerequisite.js      ← 建設業許可の保有・決算変更届提出状況の確認（クライアントレコード横断）
    inputCompleteness.js ← X1・X2・Z・Wの入力完備性チェック
    yStatus.js             ← Y（経営状況分析）の申請状況チェック
    engine.js
  documents/
    keieikiboHyouka.js     ← 経営規模等評価申請書サマリー
    keieijoukyouBunseki.js ← 経営状況分析申請書サマリー
    checklist.js             ← 必要書類チェックリスト
  reminders/
    annualCycleSchedule.js ← 年次反復型リマインド（4.3節。本モジュールの中核）
    recordResult.js          ← 経審受審記録関数（民泊のrecordReport.jsと同じ役割）
  index.js
```

`src/core/`・`src/licenses/construction/`・`src/licenses/kobutsu/`・
`src/licenses/sanpai/`・`src/licenses/minpaku/` は無変更
（`docs/DESIGN_kobutsu-core.md` の設計をそのまま前提とする）。

```
                 既存クライアントレコード（1件）
   ┌───────────────────────────────────────────┐
   │ ClientRecord                                        │
   │  fiscalYearEndIso: "2026-03-31"                      │
   │  licenses: [                                          │
   │    { licenseCategory: "construction", ... }  ← 既存    │
   │    { licenseCategory: "keiei-jiko-shinsa",             │
   │      keieiJikoShinsaDetail: {...} }         ← 本モジュールで追加 │
   │  ]                                                    │
   └───────────────────────────────────────────┘
                    ↑ 読む（4.4節 prerequisite.js）
        src/licenses/keiei-jiko-shinsa/ のeligibility判定
```

## 3. データモデル

### 3.1 `LicenseEntry` の拡張（他モジュールと同じ `<種別>Detail` パターン）

```js
/**
 * @typedef {Object} KeieiJikoShinsaDetail LicenseEntry.keieiJikoShinsaDetail の中身
 *   経審は「直近に受審した結果」を起点に、翌年・その翌年と反復して
 *   受審し続けるライセンスであるため、他モジュールの<種別>Detailと異なり
 *   「直近の実績」を保持するフィールドが中心になる（民泊のminpakuDetailと
 *   同じ設計思想。docs/DESIGN_minpaku-core.md 4.3節参照）。
 * @property {string} [latestKijunbiIso] 直近の経審の審査基準日（＝直近に経審を受けた事業年度の決算日。YYYY-MM-DD）。
 *   未受審（これから初めて申請する）場合は未設定
 * @property {string} [latestKekkaTsuchibiIso] 直近の経営規模等評価結果通知書の受領日（参考情報。有効期限の起点には使わない。4.3節参照）
 * @property {number} [latestSougouHyoutei] 直近の総合評定値（P点）。参考記録用（本モジュールでは計算しない。1.1節参照）
 * @property {string[]} [targetGyoshu] 経審を受けている業種区分の一覧（例: ["とび・土工工事業", "管工事業"]）
 * @property {"未申請" | "申請中" | "結果受領済み"} [yBunsekiStatus] 直近サイクルにおける経営状況分析（Y）の申請状況
 */
```

### 3.2 経審固有型（新設。`src/licenses/keiei-jiko-shinsa/eligibility/types.js`）

```js
/**
 * @typedef {Object} X1Input 完成工事高評点（X1）算定用の入力データ（点数は計算しない。形式チェックのみ）
 * @property {number[]} annualCompletedWorkAmounts 直前2期または3期の完成工事高（円）。要素数2または3
 * @property {"2年平均" | "3年平均"} averagingMethod
 */

/**
 * @typedef {Object} X2Input 経営規模評点（X2）算定用の入力データ
 * @property {number} latestNetAssets 直近期の自己資本額（貸借対照表の純資産合計。円）
 * @property {number} averageProfitBeforeInterest 利払前利益の平均額（円。2年平均が原則）
 */

/**
 * @typedef {Object} ZInput 技術力評点（Z）算定用の入力データ
 * @property {{ qualification: string, count: number }[]} technicalStaff 資格区分ごとの技術職員数（例: [{ qualification: "1級土木施工管理技士", count: 3 }]）
 * @property {number} averageDirectContractCompletedWorkAmount 元請完成工事高の平均額（円）
 */

/**
 * @typedef {Object} WInput 社会性等評点（W）算定用の入力データ（自己申告のフラグが中心）
 * @property {boolean} isSocialInsuranceEnrolled 社会保険（健康保険・厚生年金・雇用保険）にすべて加入しているか
 * @property {number} yearsInBusiness 営業継続年数
 * @property {boolean} hasDisasterAgreement 防災協定を締結しているか
 * @property {boolean} hasBusinessSuspensionWithin1Year 直近1年以内に指名停止・営業停止等の処分を受けたか（法令遵守状況）
 * @property {boolean} isIso9001Registered ISO9001（品質管理）の登録の有無
 * @property {boolean} isIso14001Registered ISO14001（環境管理）の登録の有無
 */

/**
 * @typedef {Object} KeieiJikoShinsaPrerequisiteInput 前提条件確認用の入力（要件定義書FR-KJ1.1〜1.3）
 * @property {boolean} isKessanHenkoTodokeSubmitted 直近決算分の決算変更届が提出済みか
 * @property {string[]} targetGyoshu 経審を受ける業種区分（1件以上）
 */

/**
 * @typedef {Object} KeieiJikoShinsaApplicantProfile 申請準備の総合入力データ
 * @property {string} applicantName
 * @property {string} [representativeName]
 * @property {KeieiJikoShinsaPrerequisiteInput} prerequisite
 * @property {X1Input} x1
 * @property {X2Input} x2
 * @property {"未申請" | "申請中" | "結果受領済み"} yBunsekiStatus Y（経営状況分析）の申請状況
 * @property {ZInput} z
 * @property {WInput} w
 */
```

## 4. モジュール詳細設計

### 4.1 `eligibility/prerequisite.js`（新規・クライアントレコード横断）

他モジュールの要件判定関数はすべて「単一の申請者プロファイル」のみを
入力に取るが、本関数は**同一クライアントレコード内の建設業許可
`LicenseEntry`の有無**を確認する必要があるため、`ClientRecord`全体を
第2引数として受け取る点が設計上の新しい要素になる。

```js
/**
 * 経審の受審前提条件（建設業許可の保有・決算変更届の提出状況・
 * 業種区分の選択）を確認する。
 *
 * @param {import('./types.js').KeieiJikoShinsaPrerequisiteInput} input
 * @param {import('../../../core/reminders/clientStore.js').ClientRecord} clientRecord
 *   経審の要件確認は、対象クライアントが既に建設業許可を保有している
 *   ことを前提とするため、単一プロファイルではなくクライアントレコード
 *   全体を受け取る（要件定義書FR-KJ1.1・FR-KJ4.2）。
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKeieiJikoShinsaPrerequisite(input, clientRecord) {
  const reasons = [];
  const constructionLicense = clientRecord.licenses?.find(
    (l) => l.licenseCategory === "construction"
  );

  if (!constructionLicense) {
    // 建設業許可が無い場合は即座に不合格とする（法定の前提条件のため、
    // 他の項目のチェックを続ける意味が無い。早期リターン）。
    return {
      key: "keieiJikoShinsaPrerequisite",
      label: "経審受審の前提条件",
      passed: false,
      reasons: ["このクライアントは建設業許可（licenseCategory: \"construction\"）を保有していません。経審は建設業許可を受けていることが前提条件です。"],
      warnings: [],
    };
  }

  let passed = true;
  if (!input.isKessanHenkoTodokeSubmitted) {
    passed = false;
    reasons.push("直近決算分の決算変更届が未提出です。経審の申請には最新の決算内容を反映した決算変更届が前提書類として必要です。");
  }
  if (!input.targetGyoshu || input.targetGyoshu.length === 0) {
    passed = false;
    reasons.push("経審を受ける業種区分が1件も選択されていません。");
  }
  if (passed) reasons.push("建設業許可の保有・決算変更届の提出・業種区分の選択、いずれも確認できました。");

  return {
    key: "keieiJikoShinsaPrerequisite",
    label: "経審受審の前提条件",
    passed,
    reasons,
    warnings: [],
  };
}
```

### 4.2 `eligibility/inputCompleteness.js`・`yStatus.js`

産廃・民泊と同じ「フラグ配列 / チェックリスト」パターン
（`docs/DESIGN_kobutsu-core.md` 5.7節、`docs/DESIGN_minpaku-core.md`
4.2節）に従う。点数計算をしないため、判定は「必須項目が入力されて
いるか」という形式チェックに限定する。

```js
/**
 * X1・X2・Z・Wの入力データが、申請に最低限必要な形式を満たしているかを
 * 確認する。評点そのものは計算しない（設計原則1章参照）。
 *
 * @param {import('./types.js').X1Input} x1
 * @param {import('./types.js').X2Input} x2
 * @param {import('./types.js').ZInput} z
 * @param {import('./types.js').WInput} w
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkInputCompleteness(x1, x2, z, w) {
  const reasons = [];
  let passed = true;

  if (!x1.annualCompletedWorkAmounts || x1.annualCompletedWorkAmounts.length < 2) {
    passed = false;
    reasons.push("X1（完成工事高）: 直前2期分以上の完成工事高が入力されていません。");
  }
  if (x2.latestNetAssets == null) {
    passed = false;
    reasons.push("X2（経営規模）: 直近期の自己資本額が未入力です。");
  }
  if (!z.technicalStaff || z.technicalStaff.length === 0) {
    passed = false;
    reasons.push("Z（技術力）: 技術職員の情報が1件も入力されていません。");
  }
  if (w.isSocialInsuranceEnrolled === undefined) {
    passed = false;
    reasons.push("W（社会性等）: 社会保険の加入状況が未入力です。");
  }
  if (passed) reasons.push("X1・X2・Z・Wの入力データは、申請に必要な形式を満たしています（点数評価は行っていません）。");

  return { key: "inputCompleteness", label: "評価項目データの入力完備性", passed, reasons, warnings: [] };
}

/**
 * @param {"未申請" | "申請中" | "結果受領済み"} yBunsekiStatus
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkYBunsekiStatus(yBunsekiStatus) {
  const passed = yBunsekiStatus === "結果受領済み";
  const reasons = passed
    ? ["経営状況分析（Y）の結果を登録経営状況分析機関から受領済みです。"]
    : [`Y（経営状況分析）は現在「${yBunsekiStatus}」です。経営規模等評価申請にはYの分析結果が必要なため、早めに登録経営状況分析機関へ申請してください。`];
  return { key: "yBunsekiStatus", label: "経営状況分析（Y）の申請状況", passed, reasons, warnings: [] };
}
```

### 4.3 `reminders/annualCycleSchedule.js`（新規パターン: 年次反復型）

本モジュールの中核。建設業許可（有効期限型・起点は許可日で不変）、
古物商許可（変更トリガー型）、民泊（定期反復型・起点は直近実績日から
一定間隔）のいずれとも異なる、**「会社ごとに固定された年次イベント
（決算）を起点に、有効期間（1年7ヶ月）を切らさないよう毎年反復して
受審し続ける」**という第4のパターンになる。

設計の要点は2つ。

1. **有効期限の起点は「審査基準日（決算日）」であり、「結果通知日」
   ではない**。有効期間は「審査基準日から1年7ヶ月」と定められている
   （国土交通省の制度解説・複数の行政書士事務所解説記事で確認済み。
   要件定義書7章参照）。結果通知を受け取るまでには審査基準日から
   数ヶ月かかるため、結果通知日を起点にすると有効期限を長く見積もり
   すぎる誤りになる。**`latestKekkaTsuchibiIso`は参考記録用に保持する
   のみで、期限計算には使わない**（3.1節）。
2. **「次回の審査基準日」は、直近の審査基準日に単純に1年を加算して
   推定する**。決算日は会社ごとに固定されており毎年ほぼ同じ月日に
   到来するため、民泊の`calcNextReportDeadline`（直近実績日+2ヶ月）
   と同じ「直近実績日を起点にした動的計算」の考え方を、月単位ではなく
   年単位に適用する形になる。決算期変更（決算月の変更）があった場合は
   この前提が崩れるため、`latestKijunbiIso`を更新する際に発注者側で
   補正することを想定する（8章）。

```js
const MONTHS_IN_VALIDITY = 19; // 1年7ヶ月 = 19ヶ月

/**
 * 審査基準日（決算日）から、経審結果の有効期限（審査基準日から1年7ヶ月）を計算する。
 * @param {string} kijunbiIso 審査基準日（YYYY-MM-DD）
 * @returns {string}
 */
export function calcYukoKigen(kijunbiIso) {
  return addMonthsIso(kijunbiIso, MONTHS_IN_VALIDITY);
}

/**
 * 直近の審査基準日から、翌年の審査基準日（次回決算日）を推定する。
 * 決算期が変わらない前提での単純な1年後推定（設計判断2参照）。
 * @param {string} latestKijunbiIso
 * @returns {string}
 */
export function calcNextKijunbi(latestKijunbiIso) {
  return addMonthsIso(latestKijunbiIso, 12);
}

/**
 * 次回決算に向けた決算変更届の提出期限（次回審査基準日から4ヶ月後。
 * 建設業法上の決算変更届の提出期限と同じ日数）を計算する。
 * @param {string} nextKijunbiIso
 * @returns {string}
 */
export function calcNextKessanHenkoDeadline(nextKijunbiIso) {
  return addMonthsIso(nextKijunbiIso, 4);
}

/**
 * 経審の再受審の推奨申請時期。決算変更届の提出直後、経営状況分析（Y）の
 * 申請に要する期間（1〜2週間程度が目安）を見込んだ上で、現行の有効期限に
 * 対して十分な余裕を持って申請できるタイミングとして、次回決算変更届
 * 提出期限の1ヶ月後を目安に設定する。
 * @param {string} nextKijunbiIso
 * @returns {string}
 */
export function calcRecommendedReapplicationDate(nextKijunbiIso) {
  return addMonthsIso(calcNextKessanHenkoDeadline(nextKijunbiIso), 1);
}

/**
 * 経審の年次反復リマインドを算出する。
 * 【設計判断】建設業許可の3段階リマインド（早期通知／推奨開始／最終締切。
 * docs/DESIGN_kobutsu-core.md 5.6節）と、民泊の「直近実績日から動的計算」
 * （docs/DESIGN_minpaku-core.md 4.3節）を組み合わせ、次の4項目を返す。
 *   ① 次回決算変更届の提出期限（経審申請の前提書類）
 *   ② 経審再受審の推奨申請時期
 *   ③ 現行の経審結果の有効期限（絶対に切らしてはならない最終締切）
 *   ④（参考）次回審査基準日そのもの
 *
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 *   license.keieiJikoShinsaDetail.latestKijunbiIso（直近の審査基準日）を
 *   入力として使う。未設定（未受審）の場合は空配列を返す。
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcKeieiJikoShinsaSchedule(license) {
  const detail = license.keieiJikoShinsaDetail;
  const latestKijunbi = detail?.latestKijunbiIso;
  if (!latestKijunbi) return []; // 未受審の場合はリマインド対象外（まず初回申請の準備を進める段階のため）

  const nextKijunbi = calcNextKijunbi(latestKijunbi);
  const yukoKigen = calcYukoKigen(latestKijunbi); // 現行結果の有効期限

  return [
    {
      type: "keiei-next-kessan-henko",
      label: "次回決算に向けた決算変更届の提出期限（経審再受審の前提書類）",
      dueDateIso: calcNextKessanHenkoDeadline(nextKijunbi),
    },
    {
      type: "keiei-recommended-reapplication",
      label: "経審 再受審の推奨申請時期",
      dueDateIso: calcRecommendedReapplicationDate(nextKijunbi),
    },
    {
      type: "keiei-validity-deadline",
      label: "現行の経営事項審査結果の有効期限（切れると公共工事の入札参加資格を維持できません）",
      dueDateIso: yukoKigen,
    },
  ];
}

/** @param {string} iso @param {number} months うるう年・月末日（31日→存在しない月）は繰り下げで丸める */
function addMonthsIso(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const totalMonthIndex = (m - 1) + months;
  const targetYear = y + Math.floor(totalMonthIndex / 12);
  const targetMonthIndex = totalMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(targetYear, targetMonthIndex, day)).toISOString().slice(0, 10);
}
```

`addMonthsIso`は建設業許可の`renewalSchedule.js`にある月単位丸め計算
（`addMonthsClamped`相当）と同じ考え方の独自実装である。既存関数を
そのままimportしなかった理由は、建設業許可側のものが「5年＝60ヶ月」を
前提にしたシグネチャになっており、本モジュールが必要とする「19ヶ月」
「4ヶ月」「1ヶ月」といった可変の月数指定に対応していないため（産廃の
`calcSanpaiSchedule`が`addYearsIso`を独自実装したのと同じ理由。
`docs/DESIGN_sanpai-core.md` 4.3節）。今後4つ目の「月単位の可変期間を
扱うモジュール」が出てきた場合、この`addMonthsIso`を`src/core/reminders/`
へ一般化することを検討する（9章）。

### 4.4 `reminders/recordResult.js`（経審受審記録関数）

民泊の`recordMinpakuReport`（`docs/DESIGN_minpaku-core.md` 4.3節）と
同じ役割。新しい経審結果を受領した際にこの関数を呼ぶことで、
`latestKijunbiIso`が更新され、次回サイクルのリマインドが再計算される
（要件定義書FR-KJ3.3）。

```js
// src/licenses/keiei-jiko-shinsa/reminders/recordResult.js
import { upsertClientLicense } from "../../../core/reminders/clientStore.js";

/**
 * 新しい経営規模等評価結果通知書を受領したことを記録し、次回リマインドの
 * 起点となる審査基準日を更新する。
 * @param {string} clientName
 * @param {string} licenseId
 * @param {string} newKijunbiIso 新たに受審した経審の審査基準日（今回受審の対象になった決算日）
 * @param {string} [kekkaTsuchibiIso] 結果通知書の受領日（参考記録用。任意）
 * @param {number} [sougouHyoutei] 総合評定値（P点）。参考記録用（任意）
 */
export async function recordKeieiJikoShinsaResult(clientName, licenseId, newKijunbiIso, kekkaTsuchibiIso, sougouHyoutei) {
  // 既存licenseを取得し、keieiJikoShinsaDetailのみ更新した上でupsertClientLicenseに渡す
  // （結合ロジックの詳細はscripts/側で実装。民泊のrecordMinpakuReportと同じ方針）。
  // 更新後、yBunsekiStatusは次サイクルに向けて"未申請"にリセットすることを推奨する
  // （新しい決算に対する経営状況分析は改めて申請が必要なため）。
}
```

### 4.5 `documents/keieikiboHyouka.js`（経営規模等評価申請書サマリー）

建設業許可の`youshiki1.js`と同じ3関数パターンを踏襲する。X1〜Wの
入力内容を表形式で整理するのみで、評点は出力しない。

```js
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').KeieiJikoShinsaApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveKeieikiboHyoukaRows(profile) {
  return [
    ["申請者名", orNotEntered(profile.applicantName)],
    ["経審を受ける業種区分", orNotEntered(profile.prerequisite?.targetGyoshu?.join("、"))],
    ["X1: 完成工事高（直近実績。参考値）", orNotEntered(profile.x1?.annualCompletedWorkAmounts?.join("円 / ") + "円")],
    ["X2: 自己資本額", orNotEntered(profile.x2?.latestNetAssets?.toLocaleString() + "円")],
    ["Z: 技術職員数（資格区分別）", orNotEntered(profile.z?.technicalStaff?.map((t) => `${t.qualification}: ${t.count}名`).join("、"))],
    ["W: 社会保険加入状況", profile.w?.isSocialInsuranceEnrolled ? "加入済み" : "未加入（要確認）"],
  ];
}

export function buildKeieikiboHyoukaDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("経営規模等評価申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveKeieikiboHyoukaRows(profile)),
        ],
      },
    ],
  });
}

export async function writeKeieikiboHyoukaDocx(profile, outPath) {
  await writeDocxFile(buildKeieikiboHyoukaDocument(profile), outPath);
}
```

`keieijoukyouBunseki.js`（経営状況分析申請書サマリー）も同じパターンで
実装し、財務諸表の主要数値（自己資本額・利払前利益・完成工事高等）を
一覧化する。`checklist.js`は民泊の`documentChecklist.js`の出力パターンを
踏襲し、コアの`buildBulletList`を用いて必要書類一覧を出力する。

## 5. `index.js`（registerScheduleFn登録）

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcKeieiJikoShinsaSchedule } from "./reminders/annualCycleSchedule.js";

/**
 * 経審申請支援アドオンをコアへ登録する。construction/index.js・
 * kobutsu/index.js 等と同じ役割。
 */
export function registerKeieiJikoShinsaLicense() {
  registerScheduleFn("keiei-jiko-shinsa", calcKeieiJikoShinsaSchedule);
}
```

CLIスクリプト・将来Webフォームで経審を扱う場合は、起動時に
`registerConstructionLicense()`（本モジュールは建設業許可の保有を
前提とするため、実務上はほぼ必ず併用される）と
`registerKeieiJikoShinsaLicense()`の両方を呼ぶこと。

## 6. 実装ステップ

1. `eligibility/`（前提条件確認 → 入力完備性チェック → Y申請状況チェック
   → 統合エンジン）。前提条件確認は既存の建設業許可クライアントデータを
   使った結合テストを最初に書く（4.1節が本モジュールの中核であるため）
2. `documents/`（経営規模等評価申請書 → 経営状況分析申請書 →
   必要書類チェックリスト）
3. `reminders/`（`annualCycleSchedule.js`の4関数 → `recordResult.js` →
   `index.js`での登録）
4. 建設業許可の既存クライアントに経審の`LicenseEntry`を追加する動作確認
   （要件定義書FR-KJ4.1）。追加後、`buildReminderDigest`が建設業許可の
   更新リマインドと経審のリマインドを両方正しく表示することを確認
5. 経審受審記録を1件記録し、次回サイクルの期限（決算変更届提出期限・
   再受審推奨時期・有効期限）が正しく再計算されることをCLIで確認

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `checkKeieiJikoShinsaPrerequisite`: 建設業許可`LicenseEntry`が存在しない
  クライアントレコードを渡した場合に即座に不合格となること（他の入力の
  正否によらず）。建設業許可があり、決算変更届提出済み・業種区分選択済み
  の場合に合格となること
- `checkInputCompleteness`・`checkYBunsekiStatus`: 各項目が未入力／
  ステータスが"未申請"「申請中」「結果受領済み」の各パターン
- `calcYukoKigen`・`calcNextKijunbi`・`calcNextKessanHenkoDeadline`・
  `calcRecommendedReapplicationDate`: 月またぎ・年またぎ・月末日
  （例: 1月31日決算 → 4ヶ月後は5月31日、19ヶ月後は8月31日という
  存在する日への丸め、および31日→存在しない月への繰り下げ丸め）の境界値
- `calcKeieiJikoShinsaSchedule`: `latestKijunbiIso`が未設定（未受審）の
  場合に空配列を返すこと。設定済みの場合に3種類のリマインドが正しい
  日付で生成されること
- `recordKeieiJikoShinsaResult`実行後、`buildReminderDigest`が再計算した
  新しい期限（次回決算基準の期限群）を返すこと（民泊と同じ「1回のリマインド
  計算で終わらない繰り返し」の動作確認）
- 建設業許可＋経審の両方を持つクライアントで、`buildReminderDigest`が
  両方の許可種別のリマインドを正しく集計すること（コアの回帰確認。
  産廃・民泊と同じ観点）
- 書類生成3モジュール: ダミーデータからdocxが生成でき、免責注記
  （「実際の評点は審査行政庁・登録経営状況分析機関の審査結果による」旨）
  が含まれること

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章を継承。追加の配慮事項:

- 経審の評価データ（自己資本額・完成工事高・利益額等）は他モジュール以上に
  クライアントの財務内容そのものであり、NFR-4（外部送信禁止）の遵守を
  実装・レビューの両方で特に重視する
- `checkKeieiJikoShinsaPrerequisite`が`ClientRecord`全体を受け取る設計
  （4.1節）は、コアの`LicenseEntry`単位のScheduleFn契約
  （`docs/DESIGN_kobutsu-core.md` 5.2節）とは別の枠組みであることを
  明確にする。将来、コアの`ScheduleFn`自体を「クライアントレコード全体を
  受け取れる」形に拡張すべきかは、9章「今後の拡張ポイント」で扱う技術的
  検討課題とし、本フェーズではeligibility側の関数シグネチャの工夫のみで
  対応する（コアのリマインド・レジストリ契約は変更しない）
- 決算期変更（決算月の変更）があった場合、`calcNextKijunbi`の「直近基準日
  +12ヶ月」という単純な推定が崩れる。決算期変更は建設業許可の変更届出
  事項でもあるため、発注者が`latestKijunbiIso`を手動で補正する運用を
  前提とする（自動検知は対象外）

## 9. 今後の拡張ポイント（本フェーズ後の検討事項）

- `checkKeieiJikoShinsaPrerequisite`のような「クライアントレコード全体を
  読むeligibility関数」パターンが今後も必要になる場合（例: 経審の実績を
  踏まえた入札参加資格審査モジュールを将来追加する場合等）、コア側に
  「同一クライアントの他ライセンスを参照するための共通ヘルパー」を
  用意することを検討する
- `addMonthsIso`（4.3節）のような可変月数の月単位丸め計算は、経審に限らず
  今後別の「年次反復型」許可種別が出てきた場合に再利用できる可能性がある。
  `docs/DESIGN_sanpai-core.md` 7章・`docs/DESIGN_minpaku-core.md` 7章と
  同じ「時期尚早な一般化を避ける」方針を踏襲し、3例目が出た時点で
  `src/core/reminders/`への切り出しを判断する
- X1〜Wの実際の評点計算・総合評定値（P点）の算出を将来実装する場合、
  国土交通省の評点テーブル（毎年度改定され得る）をどう保守するかが
  最大の技術的課題になる（ハードコードではなく設定ファイル化する等の
  検討が必要）
- 経審結果を踏まえた入札参加資格審査（指名願い）モジュールへの拡張
- 特定建設業・一般建設業の別、業種追加時の経審固有の取り扱いへの対応拡大
