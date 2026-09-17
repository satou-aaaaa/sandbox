# 設計書 — BtoB下請けケース管理ポータル

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_uketsuke-portal.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

本モジュールは許可種別アドオン（`src/licenses/<種別>/`）ではなく、
コアの一部機能（docx共通ヘルパー・永続化パターン）を再利用する
**独立した業務ドメイン**として位置づける。`docs/DESIGN_kobutsu-core.md`の
「コアは許可種別を知らない」原則にならい、本モジュールも「コアは
下請け業務のことを知らない」を維持する（`src/core/`に案件管理固有の
概念を持ち込まない）。

`registerScheduleFn`のレジストリ（許可の`LicenseEntry`を前提とした
契約）は、案件（`CaseRecord`）という別のエンティティには直接適用しない。
無理に同じ仕組みに載せようとすると、`LicenseEntry`型が案件管理の
概念まで抱え込んでしまい、コアの見通しが悪くなるため、**リマインド
集計は専用の関数として別に用意し、最終的な表示（`bucketizeAlerts`等）
だけをコアの関数に橋渡しする**設計とする（4.3節）。

## 2. 全体アーキテクチャ

```
src/portal/
  types.js               ← PartnerRecord / CaseRecord
  caseStore.js             ← 案件・元請行政書士の永続化（JSON。clientStore.jsと対になる設計）
  documents/
    mitsumorisho.js        ← 見積書サマリー
    seikyusho.js             ← 請求書サマリー
  reminders/
    caseDeadlines.js         ← 案件納期からReminderAlert相当を生成
  index.js                   ← （コアへの登録は行わない。5章参照）
```

`src/core/documents/common.js`・`src/core/reminders/digest.js`の
一部関数（`bucketizeAlerts`・`formatReminderDigest`・`REMINDER_RANGES`）
を再利用する。`src/core/reminders/scheduleTypes.js`（許可種別のレジストリ）
は使用しない。

## 3. データモデル

```js
// src/portal/types.js

/**
 * @typedef {Object} PartnerRecord 元請行政書士1件分の情報
 * @property {string} partnerId 一意なID（例: 事務所名のスラッグ）
 * @property {string} partnerName 事務所名・氏名
 * @property {string} [contactName] 担当者名
 * @property {string} [contactEmail] 連絡先メールアドレス
 */

/**
 * @typedef {Object} CaseRecord 案件1件分の情報
 * @property {string} caseId 一意なID
 * @property {string} partnerId どの元請行政書士からの依頼か（PartnerRecord.partnerIdを参照）
 * @property {string} caseName 案件名（例: "○○様 建設業許可新規申請 書類作成"）
 * @property {string} [licenseCategory} 対象許可種別（任意。コアの licenseCategory キーと合わせてもよいし自由記述でもよい）
 * @property {string} receivedDateIso 受注日
 * @property {string} dueDateIso 納期
 * @property {number} feeAmount 報酬額（円）
 * @property {"受付" | "作業中" | "納品待ち" | "完了" | "保留"} status
 * @property {string} [notes} 自由記述メモ
 */
```

`ApplicantProfile`・`ClientRecord`とは意図的に型を共有しない（NFR-U2。
最終顧客の詳細な個人情報を持たない設計を型レベルで担保する）。

## 4. モジュール詳細設計

### 4.1 `caseStore.js`

既存の`src/core/reminders/clientStore.js`と同じ設計パターン
（単一JSONファイル・`fs.readFile`/`writeFile`・ディレクトリ自動作成）を
踏襲する。永続化先は`data/partners.json`・`data/cases.json`の2ファイルに
分ける（クライアント管理の`ClientRecord`/`LicenseEntry`のような1ファイル
統合はせず、参照関係を`partnerId`で持たせるシンプルな構成とする）。

```js
export const DEFAULT_PARTNERS_PATH = "data/partners.json";
export const DEFAULT_CASES_PATH = "data/cases.json";

// loadPartners / savePartners / upsertPartner
// loadCases / saveCases / upsertCase / removeCase
// （既存clientStore.jsの対応する関数と同じ実装パターン）
```

### 4.2 `documents/mitsumorisho.js`・`seikyusho.js`

```js
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";
// 【注意】buildDisclaimerParagraph（「正式提出様式ではない」注記）は
// 見積書・請求書には使わない。これらは元々、国や自治体が定める「様式」
// ではなく発注者自身が作成する書類であり、免責注記の対象にはならないため。

/**
 * @param {import('../types.js').CaseRecord} caseRecord
 * @param {import('../types.js').PartnerRecord} partner
 * @returns {[string, string][]}
 */
export function resolveMitsumorishoRows(caseRecord, partner) {
  return [
    ["宛先", orNotEntered(partner.partnerName)],
    ["案件名", orNotEntered(caseRecord.caseName)],
    ["報酬額（税別）", `${caseRecord.feeAmount.toLocaleString()}円`],
    ["納期", orNotEntered(caseRecord.dueDateIso)],
  ];
}
// buildMitsumorishoDocument / writeMitsumorishoDocx は
// youshiki1.js と同じ3関数パターン（resolve/build/write）
```

### 4.3 `reminders/caseDeadlines.js`

`CaseRecord`一覧から、既存の`ReminderAlert`と同じ形のオブジェクトを
生成し、コアの`bucketizeAlerts`・`formatReminderDigest`にそのまま
渡せるようにする（型は流用するが、生成ロジックは案件専用に実装する）。

```js
import { daysUntil } from "../../licenses/construction/reminders/renewalSchedule.js";
// 【設計判断】daysUntilは許可種別に依存しない純粋な日数計算のため、
// 案件納期の計算にもそのまま使える。実装者の判断で、より自然な配置
// （例: src/core/dateUtils.js への切り出し）に変更してよい
// （docs/DESIGN_sanpai-core.md 4.3節と同じ技術的負債として記録）

/**
 * 未完了（status !== "完了"）の案件から、コアと同形式のリマインド項目を生成する。
 * @param {import('../types.js').CaseRecord[]} cases
 * @param {import('../types.js').PartnerRecord[]} partners
 * @param {string} [todayIso]
 * @returns {import('../../core/reminders/digest.js').ReminderAlert[]}
 */
export function buildCaseDeadlineAlerts(cases, partners, todayIso) {
  const partnerById = new Map(partners.map((p) => [p.partnerId, p]));
  return cases
    .filter((c) => c.status !== "完了")
    .map((c) => {
      const days = daysUntil(c.dueDateIso, todayIso);
      const partner = partnerById.get(c.partnerId);
      return {
        clientName: `${partner?.partnerName ?? "(元請不明)"} / ${c.caseName}`,
        type: "case-due",
        label: `納期（ステータス: ${c.status}）`,
        dueDateIso: c.dueDateIso,
        daysUntil: days,
        isOverdue: days < 0,
        contactEmail: partner?.contactEmail,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
```

呼び出し側（CLIスクリプト）は、`buildCaseDeadlineAlerts`の戻り値を
コアの`bucketizeAlerts`・`formatReminderDigest`にそのまま渡すことで、
既存のリマインド表示ロジックを再利用できる。**許可のリマインド一覧
（`buildReminderDigest`）とは別のコマンド・別の出力として扱い、
両者を強制的に1つの一覧に統合はしない**（案件と許可では性質が異なり、
無理に1つの型に統合すると`ReminderAlert`の意味が曖昧になるため。
必要であれば、呼び出し側スクリプトで両方の結果を単純に配列結合して
表示することは可能）。

## 5. コアへの統合方針（あえて`registerScheduleFn`を使わない理由）

`docs/DESIGN_kobutsu-core.md`で設計した`registerScheduleFn`は、
「`LicenseEntry`を1件受け取り、`ScheduleItem[]`を返す」という契約に
なっており、これは許可という単位を前提にしている。案件（`CaseRecord`）を
無理やり`LicenseEntry`として扱おうとすると、`licenseCategory`に
"case"のような不自然な値を持たせることになり、コア設計の一貫性
（「コアは許可種別を知らない」原則）が崩れる。

そのため本モジュールは、コアの**型・レジストリには触れず**、
`bucketizeAlerts`・`formatReminderDigest`という**表示用の関数だけ**を
再利用する設計とした。これはコア設計を汚さずに済む一方、「許可の
リマインドと案件の納期リマインドを1つの画面で横断的に見たい」という
将来のニーズには応えられない。そのニーズが実際に出てきた場合、
`ReminderAlert`をより汎用的な型（「許可」に限らない「期限のある
何か」）として再設計することを、9章の拡張ポイントとして残す。

## 6. 実装ステップ

1. `types.js`・`caseStore.js`（永続化）
2. `documents/`（見積書→請求書）
3. `reminders/caseDeadlines.js`
4. CLIスクリプト（`scripts/case-add.js`・`scripts/case-list.js`等）の追加

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `buildCaseDeadlineAlerts`: 完了済み案件が除外されること、納期超過の
  案件が`isOverdue: true`になること、`partnerId`が一致しないケースが
  混在しないこと（NFR-U3）
- `caseStore.js`: 複数の元請行政書士・複数案件を登録し、`partnerId`ごとに
  正しくフィルタできること

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章を継承。加えて、`data/partners.json`・
`data/cases.json`は`.gitignore`で除外し、実データをコミットしないこと
（既存の`data/clients.json`と同じ運用）。

## 9. 今後の拡張ポイント

- 許可のリマインドと案件の納期リマインドを1つの画面・1つのCLI
  コマンドで横断的に見たいというニーズが出てきた場合の、
  `ReminderAlert`型の再設計（5章）
- 複数案件をまとめた月次請求サマリー生成（要件定義書FR-U2.3）:
  **2026年9月実装済み**。`documents/monthlySeikyusho.js`
- Web一覧表示への対応（`src/web/`の拡張。他モジュール同様、本フェーズは対象外）
