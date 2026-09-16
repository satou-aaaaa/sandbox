# 設計書 — 住宅宿泊事業（民泊）届出モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_minpaku-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章を継承。本モジュールは「定期・反復型」の
リマインドという、コアが未検証だったパターンを実証する位置づけ。
**当初は『直近の実績日を入力に取り、次回期限を動的に計算する』という
コンセプトを想定していたが、一次資料確認の結果、実際の期限は報告実績に
一切依存しない暦日固定（毎年2/4/6/8/10/12月15日）であると判明した
（4.3節）。**そのため検証すべき論点も、「`ScheduleFn`契約（`(license)
=> ScheduleItem[]`。今日の日付を引数に取らない）が、期限日自体が時間
経過で変わる『暦日テーブル参照型』のリマインドに自然に対応できるか」に
変わる。結論としては、`scheduleFn`内部で`new Date()`により本日を取得する
ことで対応可能であり、コアの契約自体の変更は不要だった（4.3節末尾の
設計上の注意を参照）。

## 2. 全体アーキテクチャ

```
src/licenses/minpaku/
  eligibility/
    types.js
    kekkaku.js
    documentChecklist.js  ← 必要書類の充足チェック（合否判定ではなくチェックリスト）
    engine.js
  documents/
    todokedesho.js         ← 届出書サマリー
    seiyakusho.js           ← 誓約書
    checklist.js             ← 必要書類チェックリストの出力
  reminders/
    periodicReportSchedule.js ← 2ヶ月ごとの定期報告リマインド
  index.js
```

## 3. データモデル

```js
/**
 * @typedef {Object} MinpakuKekkakuInput 欠格事由（住宅宿泊事業法**第4条**。
 *   当初案は「第5条」としていたが誤り。第5条は宿泊者の衛生確保に関する
 *   条文であり欠格事由とは無関係。e-Gov法令検索で原文確認済み・2026年9月。
 *   また期間も一律5年ではなく、暴力団関係（第5号）のみ5年、他は3年
 * @property {boolean} hasMentalOrPhysicalImpairment 心身の故障により住宅宿泊事業を的確に遂行することができない者か（第1号。国土交通省令・厚生労働省令で定めるもの）
 * @property {boolean} isUndischargedBankrupt 破産手続開始の決定を受けて復権を得ないか（第2号）
 * @property {boolean} hadBusinessSuspensionOrderWithin3Years 住宅宿泊事業の廃止命令（第16条第2項）を受け3年を経過しないか（第3号。法人の場合、命令前30日以内の役員だった者を含む）
 * @property {boolean} hasCriminalRecordWithin3Years 拘禁刑以上の刑、又は本法・旅館業法違反の罰金刑に処せられ、その執行を終わり若しくは執行を受けることがなくなった日から3年を経過しないか（第4号。「5年」ではなく「3年」である点に注意）
 * @property {boolean} isBoryokudanRelated 暴力団員、又は暴力団員でなくなった日から5年を経過しない者に該当するか（第5号。8号中、唯一5年の欠格事由）
 */

/**
 * @typedef {Object} RequiredDocumentItem 必要書類チェックリストの1項目
 * @property {string} key 書類キー（例: "touki-jikou-shomeisho"）
 * @property {string} label 書類名（例: "登記事項証明書"）
 * @property {boolean} obtained 取得済みか
 * @property {boolean} [isForeignLanguage] 外国語で発行された書類で日本語訳が必要か
 */

/**
 * @typedef {Object} MinpakuApplicantProfile 届出者の総合入力データ
 * @property {string} applicantName
 * @property {string} [address]
 * @property {string} [propertyAddress] 届出住宅の所在地
 * @property {"家主居住型" | "家主不在型"} residentType
 * @property {string} [managementCompanyName] 家主不在型の場合の委託先住宅宿泊管理業者名
 * @property {MinpakuKekkakuInput} kekkaku
 * @property {RequiredDocumentItem[]} requiredDocuments
 */
```

## 4. モジュール詳細設計

### 4.1 `eligibility/kekkaku.js`

古物商許可の`checkKobutsuKekkaku`と同じ「フラグ配列」パターン
（`docs/DESIGN_kobutsu-core.md` 5.7節）を踏襲する。号立ては要件定義書
8章確定後に反映する。

### 4.2 `eligibility/documentChecklist.js`

合否判定ではなく「準備状況の可視化」が目的のため、`RequirementCheckResult`
の`passed`は「すべての必須書類が揃っているか」の意味で使い、
`reasons`に未取得の書類を列挙する形にする。

```js
/**
 * @param {import('./types.js').RequiredDocumentItem[]} documents
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkDocumentChecklist(documents) {
  const missing = documents.filter((d) => !d.obtained);
  const foreignLanguageMissingTranslation = documents.filter((d) => d.isForeignLanguage && d.obtained);
  const reasons = missing.length
    ? missing.map((d) => `${d.label}が未取得です`)
    : ["必要書類はすべて取得済みです"];
  const warnings = foreignLanguageMissingTranslation.map(
    (d) => `${d.label}は外国語発行のため、日本語訳の添付を確認してください`
  );
  return {
    key: "documentChecklist",
    label: "必要書類の充足確認",
    passed: missing.length === 0,
    reasons,
    warnings,
  };
}
```

### 4.3 `reminders/periodicReportSchedule.js`（新規パターン: 暦日固定・反復型）

**【法令確認による設計変更】** 当初案は「直近の報告日（または届出日）を
起点に2ヶ月ごとに繰り返す」という相対計算だったが、一次資料確認の結果
これは誤りだったと判明した。住宅宿泊事業法施行規則第12条第2項
（e-Gov法令検索で原文確認済み・2026年9月）は次のとおり定める:

> 住宅宿泊事業者は、届出住宅ごとに、毎年二月、四月、六月、八月、十月
> 及び十二月の十五日までに、それぞれの月の前二月における前項各号に
> 掲げる事項を、都道府県知事に報告しなければならない。

つまり報告期限は「暦年で固定された年6回（2/15・4/15・6/15・8/15・
10/15・12/15）」であり、いつ届出をしたか・前回いつ報告したかに一切
依存しない。したがって「直近の実績日を起点に動的計算する」という
当初の設計コンセプト自体が誤りであり、実装すべきは「今日（または届出日）
以降で最初に到来する固定6日付のうち最も早いもの」を返す、より単純な
暦日テーブル参照ロジックになる。**FR-M3.2で想定していた
`recordMinpakuReport`（報告実績日を起点に次回期限を再計算する関数）は
不要**（次回期限は報告実績の有無・日付によらず常に暦日で確定するため）。
`ScheduleFn`のインターフェース自体は`docs/DESIGN_kobutsu-core.md` 5.2節の
ものをそのまま使える点は当初案から変わらない。

```js
/** 施行規則第12条第2項で定める、報告期限の月（1-12）。日は毎回15日固定。 */
const REPORT_DEADLINE_MONTHS = [2, 4, 6, 8, 10, 12];

/**
 * 基準日（今日、または届出日）以降で最初に到来する定期報告の期限
 * （毎年2/4/6/8/10/12月15日のいずれか）を計算する。
 * 【設計上の注意】前回の報告実績日には一切依存しない（施行規則第12条
 * 第2項が暦年固定のため）。届出直後で最初の報告対象期間が実質1ヶ月分
 * 未満になるケースがあり得るが、報告義務自体は最初に到来する固定日を
 * 期限として発生する（部分月の扱いは報告様式側の実務であり、期限日の
 * 計算には影響しない）。
 *
 * @param {string} baseDateIso 基準日（YYYY-MM-DD。通常は今日、または届出日）
 * @returns {string}
 */
export function calcNextReportDeadline(baseDateIso) {
  const [y, m, d] = baseDateIso.split("-").map(Number);
  for (const month of REPORT_DEADLINE_MONTHS) {
    if (m < month || (m === month && d <= 15)) {
      return `${y}-${String(month).padStart(2, "0")}-15`;
    }
  }
  // 今年の12/15をすでに過ぎている場合は、翌年2/15が次回期限
  return `${y + 1}-02-15`;
}

/**
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 *   license.minpakuDetail.notificationDateIso（届出日）は「報告義務が
 *   発生しているか」のゲートとしてのみ使う（未設定＝まだ届出前のため
 *   報告義務なし・空配列）。次回期限そのものは暦日テーブルの参照のため、
 *   常に「本日」を基準に計算する（下記【設計上の注意】参照）
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcMinpakuSchedule(license) {
  const detail = license.minpakuDetail;
  if (!detail?.notificationDateIso) return [];
  const todayIso = new Date().toISOString().slice(0, 10);
  return [
    {
      type: "minpaku-periodic-report",
      label: "定期報告（宿泊実績）の次回期限",
      dueDateIso: calcNextReportDeadline(todayIso),
    },
  ];
}
```

**【設計上の注意: 起点は「届出日」ではなく「本日」】** `ScheduleFn`は
`(license) => ScheduleItem[]`という型で「今日の日付」を引数に取らない
（`docs/DESIGN_kobutsu-core.md` 5.2節）。建設業許可・産廃許可の満了日型
リマインドは「許可日から固定オフセット」で期限日自体が時間経過で
変わらない値のため問題にならないが、本モジュールの期限は「暦日テーブル
中、今日以降で最初に到来する日」という**時間経過とともに変わる値**である
ため、起点を届出日に固定すると最初のサイクル（届出直後の1回分）から
先に進まなくなってしまう（届出日を過ぎたその期の期限がいつまでも
「次回期限」として表示され続けるバグになる）。そのため
`calcNextReportDeadline`自体は任意の基準日を受け取れる純粋関数のまま
テスト容易性を保ちつつ、`calcMinpakuSchedule`側で明示的に「本日」を
基準日として渡す。`notificationDateIso`は「届出前かどうか」のゲートの
役割に限定する。

`LicenseEntry.minpakuDetail: { notificationDateIso?: string }` を
追加する（他モジュールと同じ`<種別>Detail`パターン）。

### 4.4 `index.js`

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcMinpakuSchedule } from "./reminders/periodicReportSchedule.js";

export function registerMinpakuLicense() {
  registerScheduleFn("minpaku", calcMinpakuSchedule);
}
```

## 5. 実装ステップ

1. `eligibility/`（欠格事由→書類チェックリスト→統合エンジン）
2. `documents/`（届出書→誓約書→チェックリスト出力）
3. `reminders/`（定期報告スケジュール計算→`index.js`登録）
4. 届出済みクライアントで、今日の日付に応じて正しい「次回固定日」が
   算出されることをCLIで確認（`recordMinpakuReport`のような報告実績記録
   専用関数は、期限が届出日・報告実績日に依存しなくなったため不要になった）

## 6. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `calcNextReportDeadline`: 各固定月の15日当日・前日・翌日の境界値、
  および年またぎ（12/16以降→翌年2/15）の境界値
- `calcMinpakuSchedule`: `notificationDateIso`が未設定の場合は空配列を
  返すこと（届出前は報告義務が発生しないゲートの確認）。設定されている
  場合、期限日が`notificationDateIso`の値によらず「本日」基準で算出
  されること（起点を届出日に固定するとサイクルが進まなくなるバグの
  再発防止テスト）

## 7. 非機能設計・今後の拡張ポイント

`docs/DESIGN_kobutsu-core.md` 8・9章を継承。加えて、本モジュールで
実証した「暦日テーブルを参照する固定・反復型」リマインドパターンは、
今後さらに別の定期報告型の許可種別（例: 旅館業の年次報告等）を追加する
際に再利用できる可能性がある。`calcNextReportDeadline`のような暦日
テーブル参照ロジックをコア側（`src/core/reminders/`）に一般化するかどうかは、
3例目が実際に出てきた時点で判断する（産廃モジュールの
`docs/DESIGN_sanpai-core.md` 7章と同じ「時期尚早な一般化を避ける」方針）。
