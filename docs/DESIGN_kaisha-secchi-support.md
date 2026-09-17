# 設計書 — 会社設立サポートモジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_kaisha-secchi-support.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

> 本書は`docs/DESIGN_uketsuke-portal.md`（BtoB下請けケース管理ポータル）と
> 同じ位置づけの設計書である。章立て・記法・「コアを汚さない」という
> 設計思想もそちらに合わせている。

## 1. 設計原則

本モジュールは許可種別アドオン（`src/licenses/<種別>/`）ではなく、
コアの一部機能（docx共通ヘルパー）のみを再利用する**独立した業務ドメイン**
として位置づける。`docs/DESIGN_kobutsu-core.md`の「コアは許可種別を
知らない」原則にならい、本モジュールも「コアは会社設立のことを知らない」を
維持する（`src/core/`に定款・発起人といった会社法上の概念を持ち込まない）。

`registerScheduleFn`のレジストリ（許可の`LicenseEntry`を前提とした契約）を
本モジュールでは使わない。理由は`docs/DESIGN_uketsuke-portal.md` 5章と
同じである。

- 会社設立の準備には「許可」という単位が存在しない。`LicenseEntry`型に
  `licenseCategory: "incorporation"`のような不自然な値を持たせて
  `registerScheduleFn`に登録しようとすると、`LicenseEntry`が本来
  想定していない概念（発起人・出資額・定款認証予約日）まで抱え込み、
  コア設計の一貫性（「コアは許可種別を知らない」原則）が崩れる
- 会社設立のリマインド対象（定款認証予約日・出資金払込期限）は、古物商
  許可の「変更トリガー型」・建設業許可の「満了日ベース」のような反復・
  法定サイクルではなく、**案件ごとに一度きりの単発の期日**である。
  既存の`ScheduleFn`契約（`LicenseEntry`→`ScheduleItem[]`）に無理に
  当てはめる必然性が薄い

そのため本モジュールも、コアの**型・レジストリには触れず**、
`bucketizeAlerts`・`formatReminderDigest`という**表示用の関数だけ**を
再利用する設計とする（5章）。

加えて、本モジュール固有の設計原則を1つ追加する。

- **登記に関わる書類・処理を一切実装しない**: 要件定義書1.3節の職域境界
  （設立登記の申請＝司法書士の独占業務）を実装レベルで担保するため、
  `src/incorporation/documents/`配下には「登記申請書」またはそれに類する
  様式（就任承諾書〈登記添付書類としてのもの〉・登記すべき事項の記録媒体
  生成等）を実装しない。コードレビューでは「この書類は定款・その付随書類
  として発起人段階で完結するものか、登記段階のものか」を必ず確認する

## 2. 全体アーキテクチャ

```
src/incorporation/
  types.js                    ← FounderInput / TeikanInput / IncorporationCaseRecord
  caseStore.js                  ← 案件の永続化（JSON。uketsuke-portalのcaseStore.jsと同じ設計パターン）
  documents/
    teikanSummary.js            ← 定款サマリー生成（会社形態により分岐）
    hokininKetteisho.js         ← 発起人決定書サマリー生成（株式会社のみ）
  reminders/
    incorporationSchedule.js    ← 定款認証予約日・払込期限からReminderAlert相当を生成
  index.js                      ← （コアへの登録は行わない。1章参照）
```

`src/core/documents/common.js`・`src/core/reminders/digest.js`の一部関数
（`bucketizeAlerts`・`formatReminderDigest`・`REMINDER_RANGES`）を再利用
する。`src/core/eligibility/`（要件判定エンジン）・
`src/core/reminders/scheduleTypes.js`（許可種別のレジストリ）はいずれも
使用しない（NFR-I2）。

```
                共通コア（src/core/）
   ┌───────────────────────────────────────┐
   │ documents/common.js       … docx共通ヘルパー（再利用）       │
   │ reminders/digest.js       … bucketizeAlerts等（表示のみ再利用）│
   │ eligibility/*             … 【本モジュールは使用しない】       │
   │ reminders/scheduleTypes.js… 【本モジュールは使用しない】       │
   └───────────────────────────────────────┘
                    ↑ docx共通ヘルパー・表示関数のみ呼び出し
   ┌─────────────────────┐
   │ src/incorporation/（新規実装。独立ドメイン）│
   │  types.js                     │
   │  caseStore.js                   │
   │  documents/*.js                 │
   │  reminders/incorporationSchedule.js │
   └─────────────────────┘
```

## 3. データモデル

### 3.1 定款作成データ（`src/incorporation/types.js`）

```js
/**
 * @typedef {Object} FounderInput 発起人（株式会社）または社員（合同会社）1名分の情報
 * @property {string} name 氏名又は名称（法人発起人の場合は法人名）
 * @property {string} address 住所
 * @property {number} investmentAmount 出資額（円）
 * @property {number} [investedShares] 引き受ける設立時発行株式数（株式会社のみ使用）
 * @property {boolean} [isDaihyoShain] 合同会社の代表社員として定款に定めるか（合同会社のみ使用。任意）
 */

/**
 * @typedef {Object} TeikanInput 定款作成に必要な入力データ
 *   絶対的記載事項（会社法第27条・第576条）を中心に構成する。
 *   【e-Gov法令検索で確認済み・2026年9月】株式会社（第27条）は5項目だが、
 *   合同会社（第576条）は「社員が無限責任社員又は有限責任社員のいずれで
 *   あるかの別」（同条第1項第5号）が追加され6項目になる。ただし合同会社の
 *   場合は同条第4項により内容が「社員の全部を有限責任社員とする」旨に
 *   固定されるため、`FounderInput`に新規フィールドは追加せず、
 *   `resolveTeikanSummaryRows`（4.2節）側で合同会社選択時に固定文言の行を
 *   追加する形で表現する。
 * @property {"株式会社" | "合同会社"} companyType 会社形態
 * @property {string} companyName 商号
 * @property {string[]} businessPurposes 目的（事業目的の一覧。登記事項でもある）
 * @property {string} headOfficeLocation 本店の所在地（定款上は最小行政区画〈市区町村〉までの記載でも可。具体的な所在場所は発起人決定書で定める場合がある。4.2節）
 * @property {number} capitalAmount 設立に際して出資される財産の価額（又はその最低額）
 * @property {FounderInput[]} founders 発起人（株式会社）又は社員（合同会社）の一覧（1名以上）
 * @property {string} [fiscalYearEndMonth] 事業年度の末日（例: "3月31日"）。任意的記載事項だが実務上ほぼ必須
 * @property {string} [publicNoticeMethod] 公告方法（株式会社のみ想定の相対的記載事項。未記載の場合は官報とみなされる旨を明記して案内する）
 * @property {number} [totalIssuedShares] 設立に際して発行する株式の総数（株式会社のみ使用）
 */
```

### 3.2 会社設立サポート案件（`IncorporationCaseRecord`）

```js
/**
 * @typedef {Object} IncorporationCaseRecord 会社設立サポート案件1件分の情報
 * @property {string} caseId 一意なID
 * @property {string} clientName 依頼者（発起人代表・主たる連絡窓口）の氏名
 * @property {string} [contactEmail] 依頼者の連絡先メールアドレス
 * @property {TeikanInput} teikan 定款作成用データ（3.1節）
 * @property {"ヒアリング中" | "定款起案中" | "認証待ち" | "払込待ち" | "司法書士へ引継ぎ済み" | "完了"} status
 *   ステータスの取り得る値は要件定義書3章の利用シーンに対応する。
 *   合同会社の案件は定款認証が無いため「認証待ち」を経ずに
 *   「定款起案中」→「払込待ち」へ進めてよい（厳密な遷移制約は設けない。
 *   uketsuke-portalのCaseRecord.statusと同じ運用方針）
 * @property {string} [ninshoYoteiIso] 定款認証の予約日（YYYY-MM-DD）。株式会社のみ使用。合同会社では常にundefinedとする（4.4節）
 * @property {string} [funsoKigenIso] 出資金払込の期限日（YYYY-MM-DD）。発起人が定款または発起人の決定で定めた任意の期日
 * @property {string} [funsoKanryoIso] 出資金払込が完了した日（YYYY-MM-DD）。未設定＝未完了とみなす
 * @property {string} [handoffToShihoshoshiIso] 司法書士へ書類一式を引き継いだ日（任意記録。1.3節の職域境界を運用面で徹底するための記録項目）
 * @property {string} [notes] 自由記述メモ
 */
```

`ApplicantProfile`（建設業許可）・`ClientRecord`（クライアント管理）・
`CaseRecord`（uketsuke-portal）とは意図的に型を共有しない。会社設立の
依頼者はモジュールの主たる顧客そのものであり、下請けポータルのような
「最終顧客の個人情報を持たない」制約（NFR-U2相当）は適用されない点が
uketsuke-portalとの違いである。ただし、本モジュールも顧客の個人情報を
扱うため、既存のNFR-4（外部送信禁止）は当然に適用する（8章）。

## 4. モジュール詳細設計

### 4.1 `caseStore.js`

既存の`src/core/reminders/clientStore.js`・`src/portal/caseStore.js`と
同じ設計パターン（単一JSONファイル・`fs.readFile`/`writeFile`・
ディレクトリ自動作成）を踏襲する。

```js
export const DEFAULT_CASES_PATH = "data/incorporation-cases.json";

// loadCases / saveCases / upsertCase / removeCase
// （既存clientStore.js・uketsuke-portalのcaseStore.jsと同じ実装パターン）
```

### 4.2 `documents/teikanSummary.js`（定款サマリー生成）

会社形態によって出力項目が分岐する点が、本モジュールの書類生成の
最大の特徴である。建設業許可の`youshiki1.js`・古物商許可の
`shinseisho.js`と同じ3関数パターン（`resolve<様式名>Rows` /
`build<様式名>Document` / `write<様式名>Docx`）を踏襲するが、行の
組み立て部分を会社形態で分岐させる。

```js
// src/incorporation/documents/teikanSummary.js
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

/**
 * 定款の絶対的記載事項を中心とした行データを組み立てる。
 * 【重要】これは実際の定款そのものではなく、内容確認用のサマリーである。
 * 正式な定款条文（前文・各条の体裁）への清書は、発注者本人が別途行う
 * （FR-I1.3。既存様式群と同じ「サマリー生成に徹する」設計判断）。
 *
 * @param {import('../types.js').TeikanInput} teikan
 * @returns {[string, string][]}
 */
export function resolveTeikanSummaryRows(teikan) {
  const isKabu = teikan.companyType === "株式会社";
  const rows = [
    ["会社形態", teikan.companyType],
    ["商号", orNotEntered(teikan.companyName)],
    ["目的", orNotEntered(teikan.businessPurposes?.join("\n"))],
    ["本店の所在地", orNotEntered(teikan.headOfficeLocation)],
    ["設立に際して出資される財産の価額", `${teikan.capitalAmount?.toLocaleString() ?? "未入力"}円`],
    [isKabu ? "発起人" : "社員", orNotEntered(teikan.founders?.map((f) => `${f.name}（${f.address}・${f.investmentAmount.toLocaleString()}円）`).join("\n"))],
  ];
  if (teikan.fiscalYearEndMonth) rows.push(["事業年度", teikan.fiscalYearEndMonth]);
  if (isKabu) {
    // 株式会社のみの項目。合同会社ではこれらの行自体を出力しない（FR-I1.4・FR-I4.2）。
    rows.push(["発行可能株式総数等", orNotEntered(String(teikan.totalIssuedShares ?? ""))]);
    rows.push(["公告方法", teikan.publicNoticeMethod || "未記載（未記載の場合は官報公告とみなされます）"]);
    rows.push(["定款認証", "必要（公証役場での認証手続きが必須です）"]);
  } else {
    // 合同会社は会社法第576条第1項第5号（社員が無限責任社員又は有限責任社員の
    // いずれであるかの別）が株式会社側に対応項目のない絶対的記載事項として
    // 追加される。合同会社の場合は同条第4項により内容が固定されるため、
    // 定型文として出力する（e-Gov法令検索で確認済み・2026年9月。3.1節参照）。
    rows.push(["社員の責任", "社員の全部を有限責任社員とする（会社法第576条第1項第5号・第4項）"]);
    // 合同会社は定款認証が不要である旨を明記する（要件定義書1.3節・4.4節）。
    rows.push(["定款認証", "不要（持分会社のため、公証人の認証手続きはありません）"]);
  }
  return rows;
}

export function buildTeikanSummaryDocument(teikan) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading(`${teikan.companyType} 定款 — 記載内容サマリー`),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveTeikanSummaryRows(teikan)),
        ],
      },
    ],
  });
}

export async function writeTeikanSummaryDocx(teikan, outPath) {
  await writeDocxFile(buildTeikanSummaryDocument(teikan), outPath);
}
```

### 4.3 `documents/hokininKetteisho.js`（発起人決定書サマリー生成。株式会社のみ）

合同会社には対応する概念が定款自体に吸収されることが多いため、本関数は
`companyType`が`"株式会社"`以外の場合に空の書類を作らせないよう
呼び出し側でガードする（あるいは関数内で早期リターンする）。

```js
// src/incorporation/documents/hokininKetteisho.js
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

/**
 * 発起人決定書は、定款で定めなかった事項（本店の具体的な所在場所・
 * 設立時代表取締役の選定等）を発起人の決定として書面化するものであり、
 * 株式会社の設立でのみ用いる（合同会社は業務執行社員・代表社員の定めを
 * 定款自体に記載するのが実務上一般的なため、本フェーズでは対象外とする。
 * 9章「今後の拡張ポイント」参照）。
 *
 * @param {import('../types.js').TeikanInput} teikan
 * @param {{ honTenShozaiChi?: string, daihyoTorishimariyaku?: string }} decisions
 *   本店の具体的所在場所（地番まで）・設立時代表取締役の氏名等、
 *   定款外で発起人が決定する事項
 * @returns {[string, string][]}
 */
export function resolveHokininKetteishoRows(teikan, decisions) {
  if (teikan.companyType !== "株式会社") {
    throw new Error("発起人決定書は株式会社の設立でのみ使用します（合同会社は対象外）");
  }
  return [
    ["商号", orNotEntered(teikan.companyName)],
    ["本店の具体的所在場所", orNotEntered(decisions?.honTenShozaiChi)],
    ["設立時代表取締役", orNotEntered(decisions?.daihyoTorishimariyaku)],
    ["発起人（決定に加わった者）", orNotEntered(teikan.founders?.map((f) => f.name).join("、"))],
  ];
}

export function buildHokininKetteishoDocument(teikan, decisions) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("発起人決定書 — 記載内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveHokininKetteishoRows(teikan, decisions)),
        ],
      },
    ],
  });
}

export async function writeHokininKetteishoDocx(teikan, decisions, outPath) {
  await writeDocxFile(buildHokininKetteishoDocument(teikan, decisions), outPath);
}
```

## 5. スケジュール管理（あえて`registerScheduleFn`を使わない設計）

`docs/DESIGN_kobutsu-core.md`で設計した`registerScheduleFn`は、
「`LicenseEntry`を1件受け取り、`ScheduleItem[]`を返す」という契約に
なっており、これは許可という単位・反復的な期限計算を前提にしている。
会社設立の期日（定款認証予約日・払込期限）は、`docs/DESIGN_uketsuke-portal.md`
の案件納期と同じく「案件に紐づく単発の期日」であり、無理に`LicenseEntry`
として扱おうとするとコア設計の一貫性が崩れる（1章）。

そのため本モジュールも、コアの**型・レジストリには触れず**、
`bucketizeAlerts`・`formatReminderDigest`という**表示用の関数だけ**を
再利用する。

```js
// src/incorporation/reminders/incorporationSchedule.js
import { daysUntil } from "../../licenses/construction/reminders/renewalSchedule.js";
// 【設計判断】daysUntilは許可種別に依存しない純粋な日数計算のため、
// 会社設立の期日計算にもそのまま使える。docs/DESIGN_uketsuke-portal.md
// 4.3節と同じ技術的負債として記録する（実装者の判断でcore/dateUtils.js
// 等への切り出しに変更してよい）。

/**
 * 未完了（status !== "完了"）の会社設立案件から、コアと同形式の
 * リマインド項目を生成する。定款認証予約日（株式会社のみ）・
 * 出資金払込期限の2種類を対象とする（要件定義書FR-I3.1・FR-I3.2）。
 *
 * @param {import('../types.js').IncorporationCaseRecord[]} cases
 * @param {string} [todayIso]
 * @returns {import('../../core/reminders/digest.js').ReminderAlert[]}
 */
export function buildIncorporationScheduleAlerts(cases, todayIso) {
  const alerts = [];
  for (const c of cases) {
    if (c.status === "完了") continue;

    // 定款認証予約日（株式会社のみ。合同会社はninshoYoteiIsoが常に
    // 未設定のため、このifに入らず自動的にリマインド対象から外れる。FR-I4.1）
    if (c.ninshoYoteiIso) {
      const days = daysUntil(c.ninshoYoteiIso, todayIso);
      alerts.push({
        clientName: `${c.clientName} / ${c.teikan.companyName}`,
        type: "teikan-ninsho",
        label: "定款認証の予約日",
        dueDateIso: c.ninshoYoteiIso,
        daysUntil: days,
        isOverdue: days < 0,
        contactEmail: c.contactEmail,
      });
    }

    // 出資金払込期限（払込完了記録が無い場合のみ。FR-I3.2・FR-I3.3）
    if (c.funsoKigenIso && !c.funsoKanryoIso) {
      const days = daysUntil(c.funsoKigenIso, todayIso);
      alerts.push({
        clientName: `${c.clientName} / ${c.teikan.companyName}`,
        type: "funso-kigen",
        label: "出資金払込の期限",
        dueDateIso: c.funsoKigenIso,
        daysUntil: days,
        isOverdue: days < 0,
        contactEmail: c.contactEmail,
      });
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
  // 【スコープ外の確認】設立登記そのものの期限計算はここに含めない
  // （要件定義書FR-I3.4・1.3節）。払込完了後の司法書士への引継ぎを
  // 促す注意喚起は、docx生成側の案内文言としてのみ表現し、
  // 期限計算付きのリマインド項目にはしない設計判断とした。
}
```

呼び出し側（CLIスクリプト）は、`buildIncorporationScheduleAlerts`の
戻り値をコアの`bucketizeAlerts`・`formatReminderDigest`にそのまま渡す
ことで、既存のリマインド表示ロジックを再利用できる。**許可のリマインド
一覧（`buildReminderDigest`）・BtoB下請け案件の納期一覧とは別のコマンド・
別の出力として扱い、両者を強制的に1つの一覧に統合はしない**
（`docs/DESIGN_uketsuke-portal.md` 4.3節と同じ設計判断）。

## 6. 実装ステップ

1. `types.js`・`caseStore.js`（永続化）
2. `documents/teikanSummary.js`（株式会社・合同会社の両方でダミーデータから
   生成できることを確認してから次に進める）
3. `documents/hokininKetteisho.js`（株式会社のみ）
4. `reminders/incorporationSchedule.js`
5. CLIスクリプト（`scripts/incorporation-case-add.js`・
   `scripts/incorporation-teikan-gen.js`等）の追加

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `resolveTeikanSummaryRows`: 株式会社・合同会社それぞれで、出力される
  行の項目構成が正しく切り替わること（発行可能株式総数・公告方法・
  定款認証の要否メッセージの出し分け。FR-I1.4・FR-I4.2）。合同会社選択時に
  「社員の責任」（全部を有限責任社員とする旨）の行が出力されること
  （FR-I1.2。会社法第576条第1項第5号の絶対的記載事項）
- `resolveHokininKetteishoRows`: `companyType`が`"合同会社"`の場合に
  明示的にエラーとなること（誤って合同会社の案件に対して発起人決定書を
  生成しようとする呼び出しミスを防ぐ）
- `buildIncorporationScheduleAlerts`: 完了済み案件が除外されること、
  合同会社の案件（`ninshoYoteiIso`未設定）が認証リマインドの対象に
  ならないこと、払込完了済み（`funsoKanryoIso`設定済み）の案件が
  払込期限リマインドの対象から除外されること、払込期限超過の案件が
  `isOverdue: true`になること（FR-I3.3）
- `caseStore.js`: 複数案件を登録し、`caseId`ごとに正しく読み書きできること
- 生成される書類一式（定款サマリー・発起人決定書サマリー）に、
  「登記申請書」に類する語・様式が一切含まれないことを確認するテスト
  （NFR-I3の実装面での担保。単純な文字列検索でよい）

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章を継承。加えて、本モジュール固有の
配慮事項を以下に追加する。

- `data/incorporation-cases.json`は`.gitignore`で除外し、実データを
  コミットしないこと（既存の`data/clients.json`・`data/cases.json`と
  同じ運用）
- `src/incorporation/`配下のコードが`src/core/eligibility/`・
  `src/core/reminders/scheduleTypes.js`をimportしていないことを、
  セルフレビューチェックリストの項目として追加することを推奨する
  （NFR-I2の実装面での担保）
- 定款・発起人決定書の生成関数（`documents/`配下）に「登記」「登記申請」
  という語を含む様式・案内文言を追加する変更は、レビュー時に必ず
  1.3節の職域境界との整合性を確認すること

## 9. 今後の拡張ポイント

- 会社設立後に必要となる税務署（法人設立届出書・青色申告承認申請書等）・
  都道府県税事務所・市区町村・年金事務所等への届出書類の生成
  （要件定義書4.7節スコープ外。行政書士業務として対応できる範囲か、
  税理士・社会保険労務士の職域との境界を別途整理したうえで検討する）
- 合同会社における「代表社員の互選書」等、株式会社の発起人決定書に相当する
  付随書類の対応: **2026年9月実装済み**。`documents/daihyoShainGosensho.js`
  （会社法599条3項）。あわせて、定款サマリー（`teikanSummary.js`）で
  `isDaihyoShain`フラグが一度も出力に反映されていなかったデッドフィールド
  の不具合も発見・修正した
- 現物出資・種類株式など、定款の相対的記載事項のうち高度な設計を要する
  項目への対応拡大
- 電子定款の電子署名付与を見据えた、外部署名ツールとの連携方式の検討
  （本フェーズは電子定款化の要否案内までに留める）
- 提携司法書士への書類引継ぎを、メールへの添付・共有リンクの生成といった
  形で半自動化すること（既存のmailto下書き生成〈ADR-0004〉と同じ考え方の
  応用）
- 許可のリマインド一覧・BtoB下請け案件の納期一覧・会社設立の日程一覧を
  1つの画面で横断的に見たいというニーズが出てきた場合の、`ReminderAlert`
  型の再設計（`docs/DESIGN_uketsuke-portal.md` 5章・9章と同じ将来課題）
