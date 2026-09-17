# 設計書 — 農地転用許可モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_nouchi-tenyo-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章の2原則（コアは許可種別を知らない／既存機能は
無傷で残す）をそのまま継承する。本モジュールは古物商許可・産業廃棄物収集運搬業
許可・住宅宿泊事業届出に続く「コアの4つ目の再利用実績」にあたるため、
**コア側のインターフェース（`registerScheduleFn`・`ScheduleFn`のシグネチャ・
`aggregateEligibility`・`common.js`のヘルパー）を一切変更せずに、これまでの
3パターン（有効期限型・変更トリガー型・定期反復型）のいずれとも異なる
「条件履行期限型」リマインドを実装できるか**を検証すること自体も目的の
一つとする。変更が必要になった場合は、その理由を本書に明記すること。

農地転用許可固有の追加原則として、以下も明記する。

- **立地基準の判定はあくまで一次スクリーニングであることをコードにも残す**:
  `checkRicchiKijun`（4.1節）は農地区分の最終認定機関ではない。判定結果の
  `warnings`に「農業委員会・都道府県の審査に委ねられる」旨を必ず含める
  実装とし、コメントを削除・省略しないこと

## 2. 全体アーキテクチャ

```
src/licenses/nouchi-tenyo/
  eligibility/
    types.js
    ricchiKijun.js        ← 立地基準（農地区分ごとの許可可否）の判定
    ippanKijun.js           ← 一般基準（転用の確実性・被害防除措置）の判定
    engine.js
  documents/
    shinseisho.js            ← 許可申請書サマリー
    jigyokeikakusho.js        ← 事業計画書サマリー（資金調達内訳の表を含む）
  reminders/
    conditionDeadlineSchedule.js  ← 条件履行期限型リマインド（新パターン。4.4節）
  index.js                    ← コアへの登録エントリポイント
```

`src/core/`・`src/licenses/construction/`・`src/licenses/kobutsu/`・
`src/licenses/sanpai/`・`src/licenses/minpaku/` は無変更
（`docs/DESIGN_kobutsu-core.md` の設計をそのまま前提とする）。

## 3. データモデル

### 3.1 農地転用許可 固有型（新設。`src/licenses/nouchi-tenyo/eligibility/types.js`）

```js
/**
 * @typedef {Object} NouchiTenyoRicchiKijunInput 立地基準の判定に使う入力（農地区分）
 *   【注意】農地区分の定義・例外規定の要件は農地法施行令・施行規則、および
 *   docs/REQUIREMENTS_nouchi-tenyo-core.md 1.3節の一次資料確認が完了してから
 *   確定すること。以下は要件定義書の暫定整理に基づく実装の出発点であり、
 *   確定仕様ではない。
 * @property {"農用地区域内農地" | "甲種農地" | "第1種農地" | "第2種農地" | "第3種農地"} nouchiKubun
 *   転用対象農地の区分（農業委員会への事前相談・現地確認等で確認した内容の入力）
 * @property {boolean} [hasExceptionReason] 原則不許可の区分（農用地区域内農地・
 *   甲種農地・第1種農地）に該当する場合、例外規定に該当する事情があるか
 * @property {string} [exceptionReasonNote] 例外事由の具体的な内容（自由記述。
 *   合否には影響させず、必ず人手確認を促す）
 * @property {boolean} [hasNoAlternativeLand] 第2種農地の場合、周辺の他の土地で
 *   代替可能な土地が無いか（無い場合のみ許可対象となる基準への該当有無）
 */

/**
 * @typedef {Object} NouchiTenyoIppanKijunInput 一般基準の判定に使う入力
 * @property {boolean} hasSufficientFundsAndCredit 転用を確実に行うための資力・
 *   信用が確認できるか（融資内諾書・自己資金証明等の提出状況）
 * @property {boolean} hasConstructionSchedule 工事計画・工程表が具体的に
 *   定まっているか
 * @property {boolean} hasNeighborDamagePreventionMeasures 周辺農地への
 *   被害防除措置（排水計画等）が講じられているか
 * @property {boolean} [hasNeighborConsent] 隣接農地所有者等の同意を得ているか
 *   （任意。要否は都道府県・農業委員会の運用による。未取得でも合否には
 *   影響させず警告のみとする）
 */

/**
 * @typedef {Object} ShikinChotatsuItem 資金調達内訳1件分（事業計画書用）
 * @property {string} kubun 区分（例: "自己資金", "金融機関借入"）
 * @property {number} amountYen 金額（円）
 * @property {string} [note] 備考（融資内諾書の有無等）
 */

/**
 * @typedef {Object} NouchiTenyoApplicantProfile 申請者の総合入力データ
 * @property {"4条" | "5条"} article 適用条文（4条=自己転用、5条=権利移動を伴う転用）
 * @property {string} applicantName 申請者氏名または法人名
 * @property {string} [address]
 * @property {string} [landAddress] 転用対象農地の所在地（地番）
 * @property {number} [landAreaSqm] 転用対象農地の面積（平方メートル）
 * @property {string} [purposeOfConversion] 転用の目的（例: "資材置場", "駐車場", "太陽光発電設備"）
 * @property {string} [rightsHolderName] 5条許可の場合の譲受人・借主氏名（4条の場合は未設定）
 * @property {NouchiTenyoRicchiKijunInput} ricchiKijun
 * @property {NouchiTenyoIppanKijunInput} ippanKijun
 * @property {ShikinChotatsuItem[]} [shikinChotatsu] 資金調達内訳（事業計画書用）
 */
```

### 3.2 農地転用許可のクライアント側追加情報

```js
/**
 * @typedef {Object} NouchiTenyoLicenseDetail LicenseEntry.nouchiTenyoDetail の中身
 *   古物商許可の kobutsuDetail（docs/DESIGN_kobutsu-core.md 4.4節）・
 *   産廃許可の sanpaiDetail（docs/DESIGN_sanpai-core.md 4.3節）と同じ
 *   「<種別>Detail」パターンを踏襲する。
 * @property {"4条" | "5条"} [article] 適用条文
 * @property {string} [grantDateIso] 許可年月日（参考情報。農地転用許可には
 *   更新の概念が無いため、リマインド計算の起点にはしない）
 * @property {string} [constructionStartDeadlineIso] 許可条件として付された
 *   工事着手期限日（YYYY-MM-DD）。条件が付されていない場合は未設定
 * @property {boolean} [constructionStartReported] 着手を行政書士側で確認・
 *   記録済みか。true になった時点で該当リマインドを止める
 * @property {string} [completionReportDeadlineIso] 転用完了・完了報告の
 *   期限日（YYYY-MM-DD）。許可条件として付されている場合のみ設定
 * @property {boolean} [completionReported] 完了報告書を提出済みか。
 *   true になった時点で該当リマインドを止める
 */
```

`LicenseEntry`（`src/core/reminders/clientStore.js`）の
`licenseCategory` に `"nouchi-tenyo"` を追加し、
`nouchiTenyoDetail?: NouchiTenyoLicenseDetail` を持たせる
（コア側の型定義・`clientStore.js`のロジック自体の変更は不要。
`docs/DESIGN_kobutsu-core.md` 4.2節で設計済みの「許可種別ごとの
任意サブオブジェクト」パターンがそのまま使える）。

## 4. モジュール詳細設計

### 4.1 `eligibility/ricchiKijun.js`（新規）

古物商許可の`checkKobutsuKekkaku`・産廃許可の各チェック関数と同じ
「入力→理由文の組み立て」パターンを踏襲するが、フラグの単純な真偽判定
ではなく、農地区分という列挙値に応じて判定ロジックを分岐させる点が
異なる。

```js
/**
 * 立地基準（転用対象農地の区分に応じた許可可否の原則）を判定する。
 * 【重要】区分の最終認定・例外規定の該当可否は農業委員会・都道府県の
 * 審査で決まるものであり、本関数はあくまで自己申告に基づく形式的な
 * 一次判定である。この前提を warnings から絶対に外さないこと。
 *
 * @param {import('./types.js').NouchiTenyoRicchiKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkRicchiKijun(input) {
  const reasons = [];
  const warnings = [];
  let passed;

  switch (input.nouchiKubun) {
    case "第3種農地":
      passed = true;
      reasons.push("第3種農地は原則許可の対象です");
      break;

    case "第2種農地":
      passed = !!input.hasNoAlternativeLand;
      reasons.push(
        passed
          ? "第2種農地であり、周辺に代替可能な土地が無いため許可の対象となり得ます"
          : "第2種農地です。周辺に代替可能な土地がある場合は原則不許可となります"
      );
      warnings.push(
        "代替地の有無の認定は農業委員会・都道府県の審査に委ねられます。本判定は自己申告に基づく形式的な一次判定です"
      );
      break;

    case "農用地区域内農地":
    case "甲種農地":
    case "第1種農地":
    default:
      passed = !!input.hasExceptionReason;
      reasons.push(
        passed
          ? `${input.nouchiKubun}は原則不許可ですが、申告された例外事由（${input.exceptionReasonNote ?? "詳細未記入"}）に該当する可能性があります`
          : `${input.nouchiKubun}は原則不許可です（農用地区域内農地の場合は転用許可の前に農振除外の手続が別途必要です）`
      );
      warnings.push(
        "農地区分の最終認定・例外規定への該当可否は農業委員会・都道府県の審査で決まります。必ず事前相談で確認してください"
      );
      break;
  }

  return {
    key: "ricchiKijun",
    label: "立地基準（農地区分に基づく許可の可否）",
    passed,
    reasons,
    warnings,
  };
}
```

### 4.2 `eligibility/ippanKijun.js`（新規）

```js
/**
 * 一般基準（転用の確実性・周辺農地への配慮）を判定する。建設業許可の
 * zaisanKiso.js・産廃許可の keiriKiso.js と同様、財務・計画面の確認は
 * 形式的なチェックに留める。
 *
 * @param {import('./types.js').NouchiTenyoIppanKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkIppanKijun(input) {
  const reasons = [];
  const warnings = [];
  let passed = true;

  if (!input.hasSufficientFundsAndCredit) {
    passed = false;
    reasons.push("転用を確実に行うための資力・信用が確認できていません（融資内諾書・自己資金証明等の提出が必要です）");
  }
  if (!input.hasConstructionSchedule) {
    passed = false;
    reasons.push("工事計画・工程表が具体的に定まっていません");
  }
  if (!input.hasNeighborDamagePreventionMeasures) {
    passed = false;
    reasons.push("周辺農地への被害防除措置（排水計画等）が確認できていません");
  }
  if (passed) {
    reasons.push("一般基準（転用の確実性・周辺農地への被害防除措置）を満たしています");
  }
  if (!input.hasNeighborConsent) {
    warnings.push("隣接農地所有者等の同意書の要否は都道府県・農業委員会の運用によって異なります。必ず事前相談で確認してください");
  }

  return {
    key: "ippanKijun",
    label: "一般基準（転用の確実性・周辺農地への配慮）",
    passed,
    reasons,
    warnings,
  };
}
```

### 4.3 `eligibility/engine.js`（新規）

```js
import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkRicchiKijun } from "./ricchiKijun.js";
import { checkIppanKijun } from "./ippanKijun.js";

/**
 * @param {import('./types.js').NouchiTenyoApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateNouchiTenyoEligibility(profile) {
  const checks = [checkRicchiKijun(profile.ricchiKijun), checkIppanKijun(profile.ippanKijun)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
  // 農地転用許可の整合性チェック（建設業許可の consistencyChecks.js 相当）は
  // 本フェーズでは実装しない（要件定義書スコープ外。必要になれば
  // src/licenses/nouchi-tenyo/eligibility/consistencyChecks.js を追加する）
}

/**
 * @param {import('./types.js').NouchiTenyoApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatNouchiTenyoEligibilityReport(profile, result) {
  const lines = [
    `# 農地転用許可（農地法${profile.article}）要件判定結果 — ${profile.applicantName}`,
    "",
    "※ 本判定は自己申告データに基づく一次スクリーニングです。農地区分の最終認定・許可可否の最終判断は農業委員会・都道府県が行います。",
    "",
  ];
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
```

### 4.4 `reminders/conditionDeadlineSchedule.js`（新規・「条件履行期限型」）

これまでの3パターン（建設業許可・産廃許可＝満了日ベースの**有効期限型**、
古物商許可＝変更という出来事が発生した場合のみ生じる**変更トリガー型**、
民泊届出＝直近の実績日を起点に一定周期で繰り返す**定期反復型**）に続く、
4つ目の新しいリマインドパターンとして「**条件履行期限型**」を実装する。

農地転用許可には更新の概念が無い代わりに、許可条件として「工事着手期限」
「転用の完了・完了報告の期限」等の履行期限が個別に付されることが多い。
これらの期限は許可日からの固定計算式（建設業許可の`addMonthsClamped`や
産廃許可の`calcRenewalSchedule`のような、起点日から一定期間を機械的に
算出する方式）では算出できず、**許可証に個別に記載された期限日をそのまま
入力として受け取る**点が最大の特徴である。コアの`ScheduleFn`にとっては
「日付計算をせず、入力された日付をそのまま`dueDateIso`として使う」という
最も単純なケースだが、以下の2点が他のどのパターンにも無い新しい要素になる。

1. **履行済みフラグが立った時点でリマインドが消える**こと
   （`constructionStartReported`・`completionReported`）。これは
   古物商許可の「変更が記録された場合のみリマインドが発生する」（発生条件）
   とは逆方向の制御（一度発生したリマインドを、履行の記録によって
   止める）であり、`ScheduleFn`が呼び出されるたびに`LicenseEntry`の
   最新状態を見て毎回リマインド要否を再計算するという、既存の
   `ScheduleFn`契約の設計（状態を持たない純粋関数）のままで自然に
   実現できることを確認した
2. **期限超過時に、許可取消し等のリスクに関する注記をラベルへ含める**こと
   （FR-N3.4）。ここで「基準日（今日の日付）を`ScheduleFn`に渡して
   超過の有無を判定する」という設計も検討したが、それには
   `ScheduleFn`のシグネチャ（`(license) => ScheduleItem[]`）を
   `(license, todayIso) => ScheduleItem[]`に変更する必要があり、他の
   3許可種別（建設業・古物商・産廃・民泊）の`ScheduleFn`実装や
   `src/core/reminders/digest.js`の呼び出し側にも影響が及ぶ。**本開発では
   コアのインターフェースを変更しない方針を優先し、期限超過の有無に
   かかわらず「期限超過の場合は許可取消し等のリスクがある」という
   注記を常にラベル文言へ含める**（超過していない場合は単なる予告注記
   として機能する）という設計判断とした。基準日ベースの動的な文言切替え
   （超過後だけ警告を強める等）が必要になった場合は、コアの`ScheduleFn`
   契約自体を拡張する設計変更として、9章で改めて検討する

```js
/**
 * 農地転用許可の「条件履行期限型」リマインドを計算する。
 * docs/DESIGN_nouchi-tenyo-core.md 4.4節参照。
 *
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 *   license.nouchiTenyoDetail（工事着手期限・完了報告期限と、それぞれの
 *   履行済みフラグ）を入力として使う
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcNouchiTenyoSchedule(license) {
  const detail = license.nouchiTenyoDetail;
  if (!detail) return [];

  const items = [];

  if (detail.constructionStartDeadlineIso && !detail.constructionStartReported) {
    items.push(
      buildConditionItem(
        "construction-start-deadline",
        "工事着手期限（許可条件の履行）",
        detail.constructionStartDeadlineIso
      )
    );
  }

  if (detail.completionReportDeadlineIso && !detail.completionReported) {
    items.push(
      buildConditionItem(
        "completion-report-deadline",
        "転用完了・完了報告の期限（許可条件の履行）",
        detail.completionReportDeadlineIso
      )
    );
  }

  return items; // 条件が付されていない、または履行済みの項目が無ければ空配列
}

/**
 * 許可条件1件分の ScheduleItem を組み立てる。期限超過の有無にかかわらず
 * 許可取消し等のリスクに関する注記を含める（設計判断は本節冒頭を参照）。
 * @param {string} type
 * @param {string} baseLabel
 * @param {string} dueDateIso
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem}
 */
function buildConditionItem(type, baseLabel, dueDateIso) {
  return {
    type,
    label: `${baseLabel}（期限を超過すると許可取消し等のリスクがあります。至急、農業委員会へご相談ください）`,
    dueDateIso,
  };
}
```

既存の`bucketizeAlerts`（5区分: 期限超過／1ヶ月以内／1〜3ヶ月／3〜6ヶ月／
6ヶ月超）は無変更のまま利用できる。期限超過後は自動的に「期限超過」区分に
入るため、区分自体の表示と上記ラベル文言の注記が組み合わさり、超過時に
より強い警告として画面・レポートに現れる構成になる。

### 4.5 `documents/shinseisho.js`・`documents/jigyokeikakusho.js`（新規）

建設業許可の`youshiki1.js`・産廃許可の`shinseisho.js`と同じ3関数パターン
（`resolve<様式名>Rows` / `build<様式名>Document` / `write<様式名>Docx`）を
踏襲する。`jigyokeikakusho.js`のみ、資金調達内訳の表出力に
`buildHeaderedTable`（`src/core/documents/common.js`）を再利用する点を
例示する。

```js
// src/licenses/nouchi-tenyo/documents/jigyokeikakusho.js
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  buildHeaderedTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').ShikinChotatsuItem[]} items
 * @returns {[string, string, string][]}
 */
export function resolveShikinChotatsuRows(items) {
  return (items ?? []).map((i) => [i.kubun, `${i.amountYen.toLocaleString()}円`, orNotEntered(i.note)]);
}

export function buildJigyokeikakushoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`農地転用 事業計画書 — 申請内容サマリー（農地法${profile.article}）`),
          buildDisclaimerParagraph(),
          buildLabeledTable([
            ["転用の目的", orNotEntered(profile.purposeOfConversion)],
            ["転用対象農地の所在地", orNotEntered(profile.landAddress)],
            ["転用対象農地の面積", profile.landAreaSqm ? `${profile.landAreaSqm}平方メートル` : "未入力"],
          ]),
          buildHeaderedTable(["資金調達の区分", "金額", "備考"], resolveShikinChotatsuRows(profile.shikinChotatsu)),
        ],
      },
    ],
  });
}

export async function writeJigyokeikakushoDocx(profile, outPath) {
  await writeDocxFile(buildJigyokeikakushoDocument(profile), outPath);
}
```

`shinseisho.js`（許可申請書）は申請者情報・適用条文・（5条の場合）権利
取得者情報を`buildLabeledTable`で出力する構成とする（様式確定後、
FR-N2.4の対象都道府県様式に合わせて項目を調整すること）。

## 5. `index.js`（`registerScheduleFn`登録）

```js
// src/licenses/nouchi-tenyo/index.js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcNouchiTenyoSchedule } from "./reminders/conditionDeadlineSchedule.js";

/**
 * 農地転用許可アドオンをコアへ登録する。construction/kobutsu/sanpai/minpaku
 * の各 index.js と同じ役割。
 */
export function registerNouchiTenyoLicense() {
  registerScheduleFn("nouchi-tenyo", calcNouchiTenyoSchedule);
}
```

CLIスクリプト（`scripts/generate-nouchi-tenyo-*.js` 等、新規追加分）・
将来Webフォームを農地転用許可対応させる場合は、起動時に既存の
`registerConstructionLicense()`・`registerKobutsuLicense()`・
`registerSanpaiLicense()`・`registerMinpakuLicense()`とあわせて
`registerNouchiTenyoLicense()`を呼ぶこと。

## 6. 実装ステップ

コア抽出・先行3アドオンの実装は既に完了している前提のため、追加の
リファクタリングは発生しない。実装順序は既存プロジェクトの
M1→M2→M4の順序を踏襲する。

| ステップ | 内容 |
|---|---|
| Step 1 | `eligibility/`（立地基準→一般基準→統合エンジン） |
| Step 2 | `documents/`（許可申請書→事業計画書） |
| Step 3 | `reminders/`（条件履行期限型のスケジュール計算→`index.js`での登録） |
| Step 4 | 建設業許可・産廃許可の既存クライアントに農地転用許可を追加する動作確認（FR-N3.5） |
| Step 5 | 工事着手期限・完了報告期限を設定→履行済みフラグを立てる、という一連の操作をCLIで確認し、リマインドが正しく消えることを確認する |

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `checkRicchiKijun`: 5つの農地区分（農用地区域内農地・甲種農地・第1種農地・
  第2種農地・第3種農地）それぞれについて、原則どおりの判定結果になること。
  第1種農地等で`hasExceptionReason: true`の場合に`passed: true`かつ
  `warnings`に一次判定である旨の注記が含まれること。第2種農地で
  `hasNoAlternativeLand`のtrue/falseそれぞれのケース
- `checkIppanKijun`: 3項目（資力・信用／工事計画／被害防除措置）のうち
  いずれか1つでも未充足なら`passed: false`になること。隣接同意が
  未取得の場合に`warnings`が出ること（`passed`には影響しないこと）
- `calcNouchiTenyoSchedule`:
  - `nouchiTenyoDetail`が未設定の場合に空配列を返すこと
  - 工事着手期限のみ設定・完了報告期限のみ設定・両方設定、それぞれの
    組み合わせで正しい件数の`ScheduleItem`が返ること
  - `constructionStartReported: true`の場合に工事着手期限のリマインドが
    生成されないこと（完了報告期限は独立して生成されうること）。
    `completionReported: true`の場合も同様
  - 生成される`label`に許可取消しリスクの注記が含まれること
- 建設業許可・産廃許可＋農地転用許可の複数許可を持つクライアントで、
  `buildReminderDigest`が許可種別ごとに正しくリマインドを区別して
  集計すること（コアの回帰確認）
- 書類生成2モジュール: ダミーデータからdocxが生成でき、免責注記・
  農地区分の一次判定である旨の注記が含まれること（既存の
  `youshiki1.test.js`・`shinseisho.test.js`相当のテストパターン）

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章を継承。追加の配慮事項:

- `checkRicchiKijun`が返す`warnings`から「農地区分の最終認定は農業委員会・
  都道府県が行う」旨の注記を削除・簡略化するリファクタリングを行わない
  こと（NFR-N1の担保。コードレビューのチェック項目に追加することを推奨）
- `conditionDeadlineSchedule.js`は`src/licenses/construction/`・
  `src/licenses/kobutsu/`・`src/licenses/sanpai/`・
  `src/licenses/minpaku/`のいずれの型・ヘルパーもimportしないこと
  （NFR-N3。コアが提供する`ScheduleItem`・`LicenseEntry`の型のみに依存する）

## 9. 今後の拡張ポイント（本フェーズ後の検討事項）

- **基準日（today）を`ScheduleFn`に渡す拡張の要否**: 4.4節で見送った
  「期限超過の有無に応じてラベル文言を動的に切り替える」設計は、
  農地転用許可以外の許可種別でも今後ニーズが出てくる可能性がある
  （例: 産廃許可の更新期限超過時に、より強い警告文言を出したい等）。
  複数の許可種別で同様のニーズが確認された時点で、`ScheduleFn`の
  シグネチャに`todayIso`を追加する設計変更を検討する
- **条件履行期限型の一般化**: 工事着手期限・完了報告期限以外にも、
  許可条件として個別の期限が付されるケース（例: 一時転用における
  農地復元期限）は他の許可種別でも起こり得る。`conditionDeadlineSchedule.js`
  のパターン（期限日＋履行済みフラグのペアを`ScheduleItem`化する処理）を
  `src/core/reminders/`側に「条件履行期限アイテムのビルダー」として
  一般化するかどうかは、5つ目の許可種別が実際に必要になった時点で
  判断する（産廃許可の`docs/DESIGN_sanpai-core.md` 7章・民泊届出の
  `docs/DESIGN_minpaku-core.md` 7章と同じ「時期尚早な一般化を避ける」方針）
- 転用完了後の継続的な実施状況報告（露天資材置場等、完了後複数年にわたる
  定期報告義務）への対応。実装する場合、民泊届出の「定期反復型」
  （`docs/DESIGN_minpaku-core.md` 4.3節）に近いパターンになる見込みだが、
  起点が「直近の報告日」ではなく「完了報告日から起算した複数年間」という
  期間限定つきの反復になる点で単純な流用はできない可能性がある
- 一時転用（農地復元期限の管理）への対応拡大: **2026年9月実装済み**。
  `NouchiTenyoLicenseDetail.restorationDeadlineIso`・`restored`を追加し、
  既存の条件履行期限型パターン（`conditionDeadlineSchedule.js`）を
  そのまま適用した
- 農地転用許可のWebフォーム対応（`src/web/`の拡張）
- 市街化区域内の届出案件への対応拡大（1.3節でスコープ外とした届出フロー。
  対応する場合、許可とは別の`licenseCategory`（例: `"nouchi-todokede"`）を
  新設するか、`nouchiTenyoDetail`に届出フラグを追加するかは、実際の
  ニーズが出た時点で検討する）
