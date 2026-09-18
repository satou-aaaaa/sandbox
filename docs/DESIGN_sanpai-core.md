# 設計書 — 産業廃棄物収集運搬業許可モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_sanpai-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章の2原則（コアは許可種別を知らない／
既存機能は無傷で残す）をそのまま継承する。本モジュールは古物商許可に
続く「コアの2つ目の再利用実績」にあたるため、**コア側のインターフェース
（`registerScheduleFn`・`aggregateEligibility`・`common.js`のヘルパー）を
一切変更せずに実装できるか**を検証すること自体も目的の一つとする。
変更が必要になった場合は、その理由を本書に明記すること。

## 2. 全体アーキテクチャ

```
src/licenses/sanpai/
  eligibility/
    types.js
    kekkaku.js
    koushu.js          ← 講習修了の判定
    keiriKiso.js        ← 経理的基礎の判定
    shisetsu.js          ← 運搬施設の判定
    engine.js
  documents/
    shinseisho.js        ← 許可申請書サマリー
    jigyokeikakusho.js    ← 事業計画書サマリー（運搬車両・容器の一覧表）
  reminders/
    renewalAndKoushuSchedule.js  ← 許可更新＋講習修了証、2種のリマインド
  index.js                ← コアへの登録エントリポイント
```

`src/core/`・`src/licenses/construction/`・`src/licenses/kobutsu/` は
無変更（`docs/DESIGN_kobutsu-core.md` の設計をそのまま前提とする）。

## 3. データモデル

```js
/**
 * @typedef {Object} SanpaiKekkakuInput 欠格事由（廃棄物処理法第14条第5項第2号。
 *   同号は第7条第5項第4号イ〜チを包含する形で規定。e-Gov法令検索で原文
 *   確認済み・2026年9月。当初案の4項目より対象が広いことが判明したため補正）
 * @property {boolean} hasMentalImpairmentAffectingDuties 心身の故障により業務を適切に行うことができない者か（7条5項4号イ）
 * @property {boolean} isUndischargedBankrupt 破産手続開始の決定を受けて復権を得ないか（7条5項4号ロ）
 * @property {boolean} hasCriminalRecordWithin5Years 拘禁刑以上の刑に処せられ執行終了等から5年を経過しないか（7条5項4号ハ）
 * @property {boolean} hasWasteLawViolationWithin5Years この法律・浄化槽法違反もしくはこれらに基づく処分・暴力団対策法違反、又は特定の暴力犯罪（刑法204条等）により罰金刑に処せられ5年を経過しないか（7条5項4号ニ）
 * @property {boolean} hadPermitRevokedWithin5Years 許可取消しから5年を経過しないか（法人の場合、取消し処分の通知前60日以内に役員だった者を含む。7条5項4号ホ）
 * @property {boolean} hasBusinessClosureDuringRevocationProcessWithin5Years 許可取消し処分の手続中に事業廃止の届出をして5年を経過しないか（取消し逃れ防止規定。役員・使用人であった者を含む。7条5項4号ヘ・ト）
 * @property {boolean} hasDishonestConductRisk その業務に関し不正又は不誠実な行為をするおそれがあると認めるに足りる相当の理由があるか（7条5項4号チ）
 * @property {boolean} isBoryokudanRelated 暴力団員、又は暴力団員でなくなった日から5年を経過しない者に該当するか（14条5項2号ロ。この項目のみ根拠条文が7条5項4号ではなく14条5項2号自体である点に注意）
 */

/**
 * @typedef {Object} KoushuInput 講習修了の判定に使う入力
 * @property {string} completionDateIso 講習修了証の発行年月日（YYYY-MM-DD）
 * @property {string} plannedApplicationDateIso 申請予定日（YYYY-MM-DD）。
 *   completionDateIso から5年以内であることを判定する基準日
 */

/**
 * @typedef {Object} KeiriKisoInput 経理的基礎の判定に使う入力（直近期のみの簡易判定。FR-S1.3）
 * @property {number} latestNetAssets 直近期の自己資本額（円）
 * @property {number} latestOperatingIncome 直近期の営業損益（円。参考値）
 */

/**
 * @typedef {Object} VehicleInput 運搬車両1台分の情報（事業計画書用）
 * @property {string} vehicleType 車両の種類（例: "4tダンプ"）
 * @property {string} plateNumber 登録番号
 * @property {boolean} hasSpillPreventionMeasures 飛散・流出防止措置の有無
 */

/**
 * @typedef {Object} SanpaiApplicantProfile 申請者の総合入力データ
 * @property {string} applicantName
 * @property {string} [representativeName]
 * @property {string} [address]
 * @property {string} [prefecture]
 * @property {SanpaiKekkakuInput} kekkaku
 * @property {KoushuInput} koushu
 * @property {KeiriKisoInput} keiriKiso
 * @property {boolean} hasOdorSpillPreventionMeasures 運搬容器の飛散・流出・悪臭防止措置（自己申告）
 * @property {VehicleInput[]} vehicles
 * @property {string[]} [wasteTypes] 取り扱う産業廃棄物の種類（例: ["がれき類", "木くず"]）
 */
```

## 4. モジュール詳細設計

### 4.1 `eligibility/kekkaku.js`・`koushu.js`・`keiriKiso.js`・`shisetsu.js`

いずれも建設業許可・古物商許可と同じ「フラグ配列→理由文の組み立て」
パターン（`docs/DESIGN_kobutsu-core.md` 5.7節`checkKobutsuKekkaku`参照）
に従う。`koushu.js`のみ、単純なフラグ判定ではなく日数計算を伴う点が
異なるため、シグネチャを示す。

```js
/**
 * 講習修了証の有効性（発行日から5年以内）を判定する。
 * @param {import('./types.js').KoushuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKoushu(input) {
  const expiry = addYearsIso(input.completionDateIso, 5);
  const passed = input.plannedApplicationDateIso <= expiry; // ISO文字列は辞書順比較で日付比較可能
  const reasons = passed
    ? [`講習修了証は${expiry}まで有効です（申請予定日: ${input.plannedApplicationDateIso}）`]
    : [`講習修了証の有効期限（${expiry}）が申請予定日（${input.plannedApplicationDateIso}）より前です。再受講が必要です`];
  return { key: "koushu", label: "講習修了要件", passed, reasons, warnings: [] };
}
```

`keiriKiso.js`は「`latestNetAssets < 0` なら警告付きで`passed: false`」
という単純な形式チェックのみとし、FR-S1.3の通り「直ちに不合格」ではなく
改善計画等の説明余地がある旨を`warnings`に含める。

### 4.2 `documents/jigyokeikakusho.js`

車両一覧の表出力に、既存の`buildHeaderedTable`（`src/core/documents/common.js`。
工事経歴書=`youshiki2.js`で確立したパターン）を再利用する。

```js
import { buildHeaderedTable } from "../../../core/documents/common.js";

export function resolveVehicleRows(vehicles) {
  return vehicles.map((v) => [v.vehicleType, v.plateNumber, v.hasSpillPreventionMeasures ? "○" : "要確認"]);
}
// buildHeaderedTable(["車両の種類", "登録番号", "飛散・流出防止措置"], resolveVehicleRows(profile.vehicles))
```

### 4.3 `reminders/renewalAndKoushuSchedule.js`

**【法令確認による設計変更】** 廃棄物処理法施行令第6条の9により、産廃の
許可有効期間は建設業許可と異なり一律5年ではない（新規: 5年、更新時に
優良認定基準へ適合: 7年、適合しない場合: 5年。e-Gov法令検索で原文確認
済み・2026年9月）。当初案は建設業許可の`calcRenewalSchedule`（有効期間
5年を内部でハードコード）をそのまま呼び出す設計だったが、これでは7年の
ケースを表現できない。そこで、月単位丸め計算ロジック自体を
`src/core/reminders/expirySchedule.js`に「有効期間（年数）を引数に取る」
形で切り出し、建設業許可・産廃許可の両方がこれを利用する構成に変更する
（旧`calcRenewalSchedule`は5年固定でこの新関数を呼ぶラッパーとして残し、
既存の呼び出し元・テストへの影響をゼロにする）。

```js
// src/core/reminders/expirySchedule.js（新規。許可種別非依存）
/**
 * 満了日ベースの更新リマインド一式（早期検討・準備開始・最終締切・満了日）を
 * 算出する汎用ロジック。建設業許可（5年固定）・産廃許可（5年 or 7年）の
 * 両方から利用する（`docs/DESIGN_kobutsu-core.md` 9章で予告していた
 * 「3つ目の5年更新型許可種別が出た時点でのcore切り出し」を、産廃モジュール
 * 自体が「5年 or 7年」という2パターンを持つ形で前倒しして必要になったもの）。
 * @param {string} grantDateIso 許可年月日（YYYY-MM-DD）
 * @param {number} validityYears 有効期間（年）。建設業許可は常に5、産廃許可は5または7
 * @returns {{ expiryDate: string, earlyNoticeDate: string, recommendedStartDate: string, hardDeadline: string }}
 */
export function calcExpirySchedule(grantDateIso, validityYears) { /* addMonthsClampedベースの計算。詳細はconstruction/reminders/renewalSchedule.js既存実装を移植 */ }
```

```js
// src/licenses/sanpai/reminders/renewalAndKoushuSchedule.js
import { calcExpirySchedule } from "../../../core/reminders/expirySchedule.js";

function addYearsIso(iso, years) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 *   license.grantDateIso（許可年月日）・license.sanpaiDetail.validityYears
 *   （有効期間。5または7。未設定時は5年として扱う＝優良認定なしを既定とする
 *   安全側のデフォルト）・license.sanpaiDetail.koushuCompletionDateIso
 *   （直近の講習修了証発行日）を入力として使う
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcSanpaiSchedule(license) {
  const items = [];
  if (license.grantDateIso) {
    const validityYears = license.sanpaiDetail?.validityYears ?? 5;
    const schedule = calcExpirySchedule(license.grantDateIso, validityYears);
    items.push({ type: "sanpai-renewal-prepare", label: "産廃許可 更新準備開始（満了60日前）", dueDateIso: schedule.recommendedStartDate });
    items.push({ type: "sanpai-renewal-deadline", label: "産廃許可 更新申請の最終締切（満了30日前）", dueDateIso: schedule.hardDeadline });
  }
  const koushuDate = license.sanpaiDetail?.koushuCompletionDateIso;
  if (koushuDate) {
    const koushuExpiry = addYearsIso(koushuDate, 5);
    items.push({ type: "sanpai-koushu-expiry", label: "講習修了証の有効期限（再受講の要否確認）", dueDateIso: koushuExpiry });
  }
  return items;
}
```

⚠ **2026年9月・重複解消**: `addYearsIso`は`koushu.js`（欠格事由判定側）と
`renewalAndKoushuSchedule.js`（リマインド計算側）の両方に同じ内容が
独立に再実装されていた。年数加算のみの単純な計算であり、シグネチャの
差異は無かったため、`src/core/reminders/dateUtils.js`（`daysUntil`・
`addDaysIso`と同じ場所）へ集約し、両ファイルともそちらからimportする形に
変更した。

`LicenseEntry`に`sanpaiDetail: { validityYears?: 5 | 7, koushuCompletionDateIso?: string }`を
追加する（`docs/DESIGN_kobutsu-core.md` 4.4節の`kobutsuDetail`と同じ
パターンで、許可種別ごとの詳細情報を持つフィールドを追加する設計を踏襲）。
優良認定基準そのものの判定（環境省令の実質審査）はスコープ外（4.6節）の
ため、`validityYears`は利用者が別途確認して入力する前提の参考値とする。

### 4.4 `index.js`

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcSanpaiSchedule } from "./reminders/renewalAndKoushuSchedule.js";

export function registerSanpaiLicense() {
  registerScheduleFn("sanpai", calcSanpaiSchedule);
}
```

## 5. 移行・実装ステップ

コア抽出は既に完了している前提のため、追加のリファクタリングは発生
しない。実装順序は既存プロジェクトのM1→M2→M4の順序を踏襲する。

1. `eligibility/`（欠格事由→講習修了→経理的基礎→施設→統合エンジン）
2. `documents/`（許可申請書→事業計画書）
3. `reminders/`（スケジュール計算→`index.js`での登録）
4. 建設業許可の既存クライアントに産廃許可を追加する動作確認（FR-S3.3）

## 6. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `checkKoushu`: 講習修了証の期限ちょうど・期限超過・期限内の境界値
- `calcSanpaiSchedule`: 許可満了日と講習修了証期限のどちらが先に来る
  場合でも、両方のリマインドが正しく生成されること
- 建設業許可＋産廃許可の両方を持つクライアントで、`buildReminderDigest`
  が両方の許可種別のリマインドを正しく集計すること（コアの回帰確認）

## 7. 非機能設計・今後の拡張ポイント

`docs/DESIGN_kobutsu-core.md` 8・9章を継承。4.3節の法令確認により、
月単位丸め計算ロジックは`src/core/reminders/expirySchedule.js`へ
切り出し済み（技術的負債の先送りではなく本フェーズで対応）。今後
4つ目以降の「満了日ベース」許可種別を追加する際は、この`calcExpirySchedule`
をそのまま再利用できる見込みが高い。
