# 設計書 — 許認可自動化コア拡張＋古物商許可モジュール

version: 0.2 / 2026-09 修正（実装着手前レビューで現行コードとの突き合わせ・e-Gov原文確認を反映。0.1からの変更点は末尾の改訂履歴を参照）
対応する要件定義書: `docs/REQUIREMENTS_kobutsu-core.md`

> 本書は既存の `docs/DESIGN.md`（建設業許可分）と対になる技術設計書。
> 章立て・記法は `docs/DESIGN.md` に合わせている。既存モジュールの
> 詳細な判定ロジック（ルートA〜D等）は `docs/DESIGN.md` 5章を正とし、
> 本書では再掲しない。

## 1. 設計原則

既存の `docs/DESIGN.md` 1章（ビルドレス構成・テストファースト・人手レビュー
必須・小さく作って検証する、等）をすべて継承する。加えて、本開発固有の
原則を2つ追加する。

- **コアは許可種別を知らない**: `src/core/` 配下のモジュールは、
  「建設業」「古物商」といった固有の許可種別名・法令名を一切含まない
  こと。許可種別固有の知識（判定ルール・様式・リマインド方式）はすべて
  `src/licenses/<種別>/` 配下に閉じ込める。コア側のコードレビューでは
  「この行は本当にどの許可種別にも当てはまるか」を基準にする
- **既存の建設業許可機能は無傷で残す**: リファクタリングは既存の
  公開関数の外部から見た入出力（シグネチャ・戻り値の形・生成される
  docxの内容・CLIコマンドの出力文言）を変えない。「ファイルの移動＋
  importパスの付け替え」を基本とし、ロジック自体の書き換えは最小限に
  とどめる。既存200件のテストがリファクタリングの各ステップで
  常に全通過することを、作業を進めてよいかの判断基準にする（6章参照）

## 2. 全体アーキテクチャ

既存（`docs/ARCHITECTURE.md`）のパイプラインは以下の通り。

```
① インテイク → ② 要件判定エンジン → ③ 書類自動生成
      → ④ 人手レビュー・職印押印（★唯一、自動化できない必須ステップ）
      → ⑤ 提出 → ⑥ 更新リマインドエンジン → ①へ戻る
```

このパイプライン自体は許可種別によらず共通であるという発見が、今回の
コア抽出の出発点になっている。本開発では、①〜③・⑥を「コアが提供する
骨格」と「許可種別アドオンが提供する中身」に分離する。④（人手レビュー）
は元々システム化していないため変更なし。

```
                共通コア（src/core/）
   ┌───────────────────────────────────────┐
   │ eligibility/aggregate.js  … 判定結果の集約           │
   │ documents/common.js       … docx共通ヘルパー         │
   │ reminders/scheduleTypes.js… リマインド方式のレジストリ │
   │ reminders/digest.js       … リマインド一覧の集計      │
   │ reminders/clientStore.js  … クライアント永続化(JSON)  │
   │ reminders/clientCsv.js    … CSV相互変換               │
   └───────────────────────────────────────┘
                    ↑ 呼び出し・登録
   ┌─────────────────────┐   ┌─────────────────────┐
   │ src/licenses/construction/│   │ src/licenses/kobutsu/     │
   │  （既存ロジックを移動）    │   │  （新規実装）              │
   │  eligibility/rules/*.js   │   │  eligibility/*.js         │
   │  eligibility/engine.js    │   │  documents/*.js           │
   │  documents/youshiki*.js   │   │  reminders/changeSchedule.js │
   │  reminders/renewalSchedule.js │   │  index.js（コアへの登録） │
   │  index.js（コアへの登録）  │   └─────────────────────┘
   └─────────────────────┘
```

`src/web/`（インテイク用Webフォーム）は本フェーズでは建設業許可専用の
ままとし、コア分離の対象に含めない（要件定義書4.6節）。

## 3. ディレクトリ構成（変更差分）

| 現状パス | 新パス | 変更種別 |
|---|---|---|
| `src/eligibility/types.js` | `src/licenses/construction/eligibility/types.js` | 移動（中身は無変更） |
| `src/eligibility/rules/*.js` | `src/licenses/construction/eligibility/rules/*.js` | 移動（中身は無変更） |
| `src/eligibility/engine.js` | `src/licenses/construction/eligibility/engine.js` | 移動＋集約部分を`src/core/eligibility/aggregate.js`呼び出しに置換 |
| `src/eligibility/prefectureRules.js` | `src/licenses/construction/eligibility/prefectureRules.js` | 移動（中身は無変更。都道府県ルールは建設業許可固有のため） |
| `src/eligibility/consistencyChecks.js` | `src/licenses/construction/eligibility/consistencyChecks.js` | 移動（中身は無変更） |
| `src/documents/common.js` | `src/core/documents/common.js` | 移動（中身は無変更。既に許可種別非依存） |
| `src/documents/youshiki*.js`（8ファイル。youshiki1・2・6・7・8・16・20-2・25-14） | `src/licenses/construction/documents/youshiki*.js` | 移動＋`common.js`のimportパスのみ変更 |
| `src/reminders/renewalSchedule.js` | `src/licenses/construction/reminders/renewalSchedule.js` | 移動。ただし`daysUntil`のみ`src/core/reminders/dateUtils.js`へ実体を切り出し、こちらは再エクスポートする（5.3節。許可種別に依存しない関数をコア側に置くという1章の原則に沿わせるため） |
| `src/reminders/reminderDigest.js` | `src/core/reminders/digest.js` | 移動＋スケジュール計算をプラグイン方式に変更（5.3節） |
| `src/reminders/clientStore.js` | `src/core/reminders/clientStore.js` | 移動＋`licenseCategory`のデフォルト補完を追加（5.4節） |
| `src/reminders/clientCsv.js` | `src/core/reminders/clientCsv.js` | 移動＋`licenseCategory`列を追加（5.5節） |
| （新規） | `src/core/eligibility/aggregate.js` | 新規（5.1節） |
| （新規） | `src/core/reminders/scheduleTypes.js` | 新規（5.2節） |
| （新規） | `src/core/reminders/dateUtils.js` | 新規。`daysUntil`の実体（5.3節） |
| （新規） | `src/licenses/construction/index.js` | 新規。コアへの登録エントリポイント（5.6節） |
| （新規） | `src/licenses/kobutsu/eligibility/kekkaku.js` | 新規（5.7節） |
| （新規） | `src/licenses/kobutsu/eligibility/eigyosho.js` | 新規（5.8節） |
| （新規） | `src/licenses/kobutsu/eligibility/engine.js` | 新規（5.9節） |
| （新規） | `src/licenses/kobutsu/eligibility/types.js` | 新規（4.2節） |
| （新規） | `src/licenses/kobutsu/documents/shinseisho.js` | 新規（5.10節・許可申請書） |
| （新規） | `src/licenses/kobutsu/documents/seiyakusho.js` | 新規（5.11節・誓約書） |
| （新規） | `src/licenses/kobutsu/documents/rirekisho.js` | 新規（5.12節・略歴書） |
| （新規） | `src/licenses/kobutsu/reminders/changeSchedule.js` | 新規（5.13節） |
| （新規） | `src/licenses/kobutsu/index.js` | 新規。コアへの登録エントリポイント（5.14節） |
| `src/web/` | `src/web/`（変更なし） | 既存の建設業許可向けimportパスのみ、移動後のパスに追従 |
| `scripts/*.js` | 変更なし（importパスのみ追従） | |
| `test/` | 既存テストのimportパスを新パスに追従。新規テストを追加 | 7章参照 |

`node_modules`・`out`・`data/clients.json` 等の運用データは対象外。

## 4. データモデル

### 4.1 コア共通型（新設。`src/core/eligibility/types.js`）

```js
/**
 * @typedef {Object} RequirementCheckResult 個別要件の判定結果（既存 types.js から移動。無変更）
 * @property {string} key
 * @property {string} label
 * @property {boolean} passed
 * @property {string[]} reasons
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} EligibilityResult 総合判定結果（既存から移動。無変更）
 * @property {boolean} eligible
 * @property {RequirementCheckResult[]} checks
 * @property {string[]} blockingIssues
 * @property {ConsistencyWarning[]} [consistencyWarnings] 整合性チェックの注記（許可種別によっては未実装でもよい。任意化）
 */

/**
 * @typedef {Object} ConsistencyWarning（既存から移動。無変更）
 * @property {string} key
 * @property {string} message
 */
```

`ApplicantProfile`（建設業許可固有の巨大な型）はコアへ移動しない。
`src/licenses/construction/eligibility/types.js` に残し、
`ApplicantProfile` という名前も変更しない（既存コードへの影響を避けるため）。

### 4.2 クライアント管理モデルの拡張（`src/core/reminders/clientStore.js` 等）

既存 `ClientRecord`/`LicenseEntry`（ADR-0008）を次のように拡張する。

```js
/**
 * @typedef {Object} LicenseEntry 許可1件分の情報（ADR-0008 + 本開発で拡張）
 * @property {string} licenseId クライアント内で一意なラベル
 * @property {"construction" | "kobutsu"} [licenseCategory]
 *   許可種別を示すキー。省略時は "construction" とみなす（後方互換。下記参照）
 * @property {"一般" | "特定"} [licenseType] 建設業許可のみで使用するフィールド（無変更）
 * @property {string} [grantDateIso] 建設業許可のみで使用。古物商許可では未使用
 * @property {KobutsuLicenseDetail} [kobutsuDetail] 古物商許可の場合のみ使用する追加情報（4.3節）
 */
```

`licenseCategory` を省略した場合は `"construction"` とみなす後方互換を
`clientStore.js` の `loadClients()` に実装する（既存の
`migrateClientIfNeeded` と同じ関数内で、旧形式変換の直後に
`licenseCategory ??= "construction"` を補う形。専用の移行スクリプトは
用意しない。既存のlazy migration方針を踏襲）。

`grantDateIso` は建設業許可のみが使うフィールドとして残し、古物商許可は
`kobutsuDetail` に許可日等を持たせる（型を無理にどちらの許可種別にも
共通化しようとすると、建設業許可側の既存フィールドの意味が曖昧になる
ため。コアは「`licenseCategory` に応じてどのフィールドを見るか」を
知らなくてよい設計にする。詳細は5.2節のプラグイン方式を参照）。

### 4.3 古物商許可 固有型（新設。`src/licenses/kobutsu/eligibility/types.js`）

```js
/**
 * @typedef {Object} KobutsuKekkakuInput 欠格事由（古物営業法第4条）の判定に使う入力
 *   フィールドの号立ては docs/REQUIREMENTS_kobutsu-core.md 8.1節のとおり、
 *   2026年9月にe-Gov法令検索の原文（令和7年6月1日施行版）で確認済み。
 *   第十号（管理者選任の見込みなし）は行政庁の裁量的判断のため本型には
 *   含めず、FR-K1.3・checkKobutsuEigyoshoで実務上カバーする。第十一号
 *   （法人役員の欠格）は個人申請のみが対象のため対象外。
 * @property {boolean} isUndischargedBankrupt 破産手続開始の決定を受けて復権を得ないか（第一号）
 * @property {boolean} hasCriminalRecordWithin5Years 拘禁刑以上の刑、又は第31条・刑法上の特定の罪により罰金の刑に処せられ5年を経過しないか（第二号。「拘禁刑」は令和7年6月1日施行の現行用語。「禁錮」ではない）
 * @property {boolean} hasBoryokuFuhouKoiRisk 集団的・常習的な暴力的不法行為等を行うおそれがあるか（第三号）
 * @property {boolean} hasBoryokudanRelatedOrderWithin3Years 暴力団関連の命令・指示を受け3年を経過しないか（第四号）
 * @property {boolean} isAddressUnknown 住居の定まらない者か（第五号）
 * @property {boolean} hadLicenseRevokedWithin5Years 古物商・古物市場主の許可取消しから5年を経過しないか（第六号）
 * @property {boolean} hasSurrenderedLicenseDuringRevocationHearingWithin5Years 許可取消しの聴聞公示後、取消しを免れるため許可証を返納した者（廃止について相当な理由がある者を除く）で返納から5年を経過しないか（第七号。第六号の現に取消された場合とは別の独立した欠格事由）
 * @property {boolean} hasMentalImpairmentAffectingDuties 心身の故障により業務を適正に行うことができない者として国家公安委員会規則で定めるものか（第八号）
 * @property {boolean} isMinorWithoutCapacity 営業に関し成年者と同一の行為能力を有しない未成年者か（第九号。例外規定の該当有無は別フィールドで扱う）
 * @property {boolean} [isHeirWithQualifiedLegalRepresentative] 未成年者だが、古物商・古物市場主の相続人であり、かつその法定代理人が欠格事由（一号〜八号・十一号）のいずれにも該当しない場合の例外に該当するか（任意。該当する場合のみtrue。「法定代理人の許可があれば良い」という一般的な話ではなく、事業相続のケースに限定される点に注意）
 */

/**
 * @typedef {Object} KobutsuEigyoshoInput 営業所・管理者要件の判定に使う入力（営業所単位）
 * @property {string} officeName 対象営業所名
 * @property {boolean} hasLegitimateUsageRight 営業所の実在性・使用権限（賃貸借契約書等）を確認済みか
 * @property {string} managerName 管理者の氏名
 * @property {boolean} isManagerFullTime 管理者が常勤であるか（【注意】この「常勤性」要件は古物営業法第13条の条文本文には記載がなく、施行規則または実務運用に由来すると見られるが2026年9月時点で一次資料未確認。そのためkekkaku.js側の欠格事由としてではなく、FR-K1.2と同様「機械的に判定しきれない項目として人手確認を促す警告」の扱いに留める。docs/REQUIREMENTS_kobutsu-core.md 8.2節参照）
 */

/**
 * @typedef {Object} KobutsuApplicantProfile 申請者（個人）の総合入力データ
 *   法人申請は本フェーズ対象外のため、法人固有フィールド（役員一覧等）は持たない。
 * @property {string} applicantName 申請者氏名
 * @property {string} [applicantNameKana] 申請者氏名のフリガナ
 * @property {string} [birthDate] 生年月日（YYYY-MM-DD、任意）
 * @property {string} [address] 住所
 * @property {string} [phoneNumber] 電話番号
 * @property {string} [businessName] 屋号（任意）
 * @property {KobutsuKekkakuInput} kekkaku
 * @property {KobutsuEigyoshoInput[]} eigyoshoList 営業所ごとの情報（1件以上）
 * @property {string[]} [handledItemCategories] 取り扱う古物の区分（例: ["古物一般"]。届出書上は13区分から選択）
 * @property {boolean} [usesInternet] インターネットを利用して取引を行うか
 * @property {string} [url] インターネット利用時のURL（届出対象。任意）
 * @property {string} [representativeHistory] 略歴書用の職歴・経歴の自由記述（過去5年分が目安。任意）
 */
```

### 4.4 古物商許可のクライアント側追加情報

```js
/**
 * @typedef {Object} KobutsuLicenseDetail LicenseEntry.kobutsuDetail の中身
 * @property {string} [grantDateIso] 許可年月日（リマインド計算の起点にはしない。参考情報）
 * @property {string} [lastRecordedChangeDateIso] 直近に記録した記載事項変更日（書換申請の期限計算の入力。5.13節）
 * @property {string} [closureDateIso] 廃業日（返納期限の計算の入力。5.13節。廃業していない場合は未設定）
 */
```

## 5. モジュール詳細設計

### 5.1 `src/core/eligibility/aggregate.js`（新規）

既存 `src/eligibility/engine.js` の `evaluateEligibility` のうち、
建設業許可の5要件を呼び出す部分を除いた「集約ロジック」のみを抽出する。

```js
/**
 * 個別のRequirementCheckResult配列から、総合判定結果を集約する。
 * 許可種別に依存しない、判定ロジックの「集約」部分のみを担う。
 *
 * @param {import('./types.js').RequirementCheckResult[]} checks
 * @returns {{ eligible: boolean, blockingIssues: string[] }}
 */
export function aggregateEligibility(checks) {
  const eligible = checks.every((c) => c.passed);
  const blockingIssues = checks
    .filter((c) => !c.passed)
    .map((c) => `[${c.label}] ${c.reasons.filter((r) => r).join(" / ")}`);
  return { eligible, blockingIssues };
}

/**
 * 判定結果を人間可読なテキストレポートに整形する共通部分。
 * 既存の formatEligibilityReport（construction固有の見出し文言・
 * consistencyWarningsの扱い）はそのまま construction 側に残し、
 * こちらはレポートの「本体部分（各要件のチェック結果一覧）」の
 * 組み立てだけを共通化する。
 *
 * @param {import('./types.js').RequirementCheckResult[]} checks
 * @returns {string[]} テキスト行の配列（呼び出し側で見出し等と結合する）
 */
export function formatChecksSection(checks) {
  const lines = [];
  for (const c of checks) {
    lines.push(`## ${c.passed ? "○" : "×"} ${c.label}`);
    for (const r of c.reasons) lines.push(`- ${r}`);
    for (const w of c.warnings) lines.push(`  - ⚠ ${w}`);
    lines.push("");
  }
  return lines;
}
```

移動後の `src/licenses/construction/eligibility/engine.js` は次のようになる
（既存の`evaluateEligibility`・`formatEligibilityReport`の公開シグネチャ・
戻り値は完全に維持する）。

```js
import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
// ...既存の5要件チェック関数・prefectureRules・consistencyChecksのimportは変更なし

export function evaluateEligibility(profile) {
  const checks = [ /* 既存と同じ5要件＋都道府県固有ルール */ ];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  const consistencyWarnings = checkConsistency(profile);
  return { eligible, checks, blockingIssues, consistencyWarnings };
}

export function formatEligibilityReport(profile, result) {
  const lines = [`# 建設業許可 要件判定結果 — ${profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 5要件すべて充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  // 以下、既存のblockingIssues・consistencyWarningsの出力は変更なし
}
```

### 5.2 `src/core/reminders/scheduleTypes.js`（新規）

既存の `src/eligibility/prefectureRules.js`（`registerPrefectureRules`/
`getPrefectureRules`）と同じ「レジストリパターン」を、リマインドの
スケジュール計算に適用する。

```js
/**
 * 許可種別ごとのリマインド・スケジュール計算関数を登録・取得する仕組み。
 * `src/eligibility/prefectureRules.js` の都道府県ルール登録と同じ設計思想。
 *
 * 各許可種別は、自身の LicenseEntry から「発生するリマインド項目の配列」を
 * 計算する関数を1つ登録する。建設業許可は「満了日ベース」、古物商許可は
 * 「変更トリガー型（変更が記録されている場合のみ発生）」というように、
 * 中身のロジックは許可種別ごとに全く異なってよい。コア側はその違いを
 * 一切意識しない。
 */

/**
 * @typedef {Object} ScheduleItem 1件分のリマインド予定
 * @property {string} type リマインド種別キー（許可種別ごとに自由に定義してよい。例: "renewal-deadline", "shokan-shinsei"）
 * @property {string} label 人間可読なラベル
 * @property {string} dueDateIso 期限日（YYYY-MM-DD）
 */

/**
 * @typedef {(license: import('./clientStore.js').LicenseEntry) => ScheduleItem[]} ScheduleFn
 *   1件の許可情報から、発生するリマインド予定の配列を返す関数。
 *   リマインドが発生しない場合は空配列を返してよい（古物商許可で
 *   変更記録が無い場合など）。
 */

/** @type {Map<string, ScheduleFn>} */
const registry = new Map();

/**
 * 許可種別ごとのスケジュール計算関数を登録する。
 * @param {string} licenseCategory 例: "construction", "kobutsu"
 * @param {ScheduleFn} scheduleFn
 */
export function registerScheduleFn(licenseCategory, scheduleFn) {
  registry.set(licenseCategory, scheduleFn);
}

/**
 * 指定した許可種別に登録済みのスケジュール計算関数を取得する。
 * 未登録の場合は undefined を返す（＝その許可種別のリマインドは生成しない）。
 * @param {string} licenseCategory
 * @returns {ScheduleFn | undefined}
 */
export function getScheduleFn(licenseCategory) {
  return registry.get(licenseCategory);
}

/** テスト用の後片付け。本番コードから呼ばない。 */
export function clearScheduleFns() {
  registry.clear();
}
```

### 5.3 `src/core/reminders/digest.js`（既存 `reminderDigest.js` を移動＋拡張）

既存の `buildReminderDigest` の内側ループを、`calcRenewalSchedule` の
直接呼び出しから `getScheduleFn(...)` 経由の呼び出しに置き換える。
**CLI・Web向けの出力形式（`formatReminderDigest`・`bucketizeAlerts`・
`ReminderAlert`型）は一切変更しない**（既存の建設業許可の表示が
変わらないようにするため）。

⚠ **設計レビューで判明した原則違反の解消**: `daysUntil` は許可種別に
依存しない純粋な日数計算であり、1章の設計原則「コアは許可種別を知らない」
に従えば `src/core/` 側に置くべきだが、`旧版0.1`ではコード例が
`src/licenses/construction/reminders/renewalSchedule.js`（建設業許可専用
パス）から直接importしており、コア自身が原則に反する形になっていた。
以下のように解消する。

- `daysUntil` を新設の `src/core/reminders/dateUtils.js` へ実体を移す
- `src/licenses/construction/reminders/renewalSchedule.js`（旧
  `daysUntil` の置き場所）は、既存の呼び出し元（テスト・スクリプト）の
  importパスを壊さないよう、`export { daysUntil } from
  "../../../core/reminders/dateUtils.js";` で再エクスポートする
  （NFR-C1「移動＋re-export」の方針をここでも踏襲する）

```js
// src/core/reminders/dateUtils.js（新規）
/**
 * ある基準日時点で、指定日までの残り日数を計算する。許可種別に依存しない
 * 純粋な日数計算のため、コア側に置く（既存 renewalSchedule.js から移動）。
 * @param {string} targetDateIso
 * @param {string} [fromDateIso] 省略時は本日
 * @returns {number} 残り日数（負の場合は既に過ぎている）
 */
export function daysUntil(targetDateIso, fromDateIso) { /* 既存実装をそのまま移動 */ }
```

```js
// src/core/reminders/digest.js
import { getScheduleFn } from "./scheduleTypes.js";
import { daysUntil } from "./dateUtils.js";

export function buildReminderDigest(records, todayIso) {
  const alerts = [];
  for (const record of records) {
    for (const license of record.licenses) {
      const category = license.licenseCategory ?? "construction";
      const scheduleFn = getScheduleFn(category);
      if (!scheduleFn) continue; // 未登録の許可種別はリマインド対象外
      for (const item of scheduleFn(license)) {
        alerts.push(makeAlert(record, item.type, item.label, item.dueDateIso, todayIso, license));
      }
    }
    if (record.fiscalYearEndIso) {
      // 決算変更届は建設業許可固有の概念のため、本来はconstruction側の
      // scheduleFnの中で「クライアント単位の追加リマインド」として
      // 扱いたいが、現行実装はrecord単位（許可ループの外）でしか
      // 発生しない特殊な形になっている。本開発では既存の出力を
      // 変えないことを優先し、この分岐をそのまま残す
      // （3つ目以降の許可種別を追加する際、「クライアント単位の
      //   追加リマインド」という概念自体をコア側に一般化するかは
      //   9章「今後の拡張ポイント」で再検討する）。
      const kessanDeadline = calcKessanHenkoDeadline(record.fiscalYearEndIso);
      alerts.push(makeAlert(record, "kessan-henko", "決算変更届の提出期限", kessanDeadline, todayIso));
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}
```

`makeAlert`・`filterDueAlerts`・`REMINDER_RANGES`・`bucketizeAlerts`・
`formatReminderDigest`・`buildReminderMailtoUrl` は無変更のまま
`src/core/reminders/digest.js` に移動する。

### 5.4 `src/core/reminders/clientStore.js`（既存 `clientStore.js` を移動＋拡張）

⚠ **設計レビューで判明した注意点**: 現行の `migrateClientIfNeeded` には
「旧形式→新形式変換」と「既に新形式ならそのまま返す」という2つの
リターン経路があり、`licenseCategory` の補完をこの関数の内側に
実装すると、うっかり片方の経路にしか適用されない実装ミスが起きやすい
（本開発以前に保存された既存の `data/clients.json` は「既に新形式」の
経路を通るため、そちらへの適用漏れが特に起きやすい）。この関数自体は
書式変換のみに専念させ、`licenseCategory` の補完は **`loadClients()` 側で
独立した `.map()` ステップとして両経路に一律に適用する**設計に変更する。

```js
/** 旧形式↔新形式の変換のみを行う。licenseCategoryの補完はここでは行わない（無変更）。 */
function migrateClientIfNeeded(client) {
  // ...既存の「旧形式（grantDateIsoを直下に持つ）→ licenses配列」変換は無変更...
}

/**
 * 本開発で追加: 各許可の licenseCategory が未設定の場合、"construction" を
 * 補う（本開発以前に保存された既存データはすべて建設業許可であるため）。
 * migrateClientIfNeeded とは独立したステップにすることで、
 * 「旧形式変換された場合」「既に新形式だった場合」の両方に漏れなく適用する。
 */
function applyLicenseCategoryDefault(client) {
  return {
    ...client,
    licenses: client.licenses.map((l) => ({ licenseCategory: "construction", ...l })),
  };
}

export async function loadClients(filePath = DEFAULT_CLIENTS_PATH) {
  // ...既存のファイル読み込み・JSON.parse・配列チェックは無変更...
  return data.map(migrateClientIfNeeded).map(applyLicenseCategoryDefault);
}
```

`upsertClient`・`upsertClientLicense`・`removeClient` の公開シグネチャは
無変更。`upsertClientLicense` を古物商許可でも使う場合、呼び出し側が
`license.licenseCategory = "kobutsu"` を指定する（コア側は種別を
意識しない。5.14節参照）。

### 5.5 `src/core/reminders/clientCsv.js`（既存 `clientCsv.js` を移動＋拡張）

`COLUMNS` に `licenseCategory` を追加する。既存CSV（列が無い場合）は
`clientCsv.js` の既存パターン（`licenseId`列が無い旧形式CSVを"既定"として
読み込む後方互換）にならい、`licenseCategory`列が無い行は `"construction"`
として読み込む。

```js
const COLUMNS = ["clientName", "licenseId", "licenseCategory", "licenseType", "grantDateIso", "fiscalYearEndIso", "contactEmail"];
```

⚠ **設計レビューで判明した重大な見落とし**: 現行の `clientsFromCsv()` は
`if (!record.clientName || !record.grantDateIso) continue;` として、
`grantDateIso` が空の行を無条件で不正データとみなしスキップしている。
古物商許可は `grantDateIso` を持たない設計（4.4節。許可日は
`kobutsuDetail.grantDateIso` に格納する）のため、**この分岐を直さないと
古物商許可のクライアントをCSV経由で登録した際、全行が黙って読み捨てられる**。
`grantDateIso` の必須チェックは `licenseCategory === "construction"` の
場合のみに限定すること。

```js
export function clientsToCsv(clients) {
  // ...COLUMNSに合わせてrowへlicenseCategory: license.licenseCategory も追加すること...
}

export function clientsFromCsv(text) {
  // ...
  for (const row of dataRows) {
    // ...record組み立ては無変更...
    if (!record.clientName) continue;
    const licenseCategory = record.licenseCategory || "construction";
    // grantDateIso必須チェックは建設業許可のみに限定する（古物商許可は
    // grantDateIsoを持たないため、ここで一律に弾くと古物商許可の行が
    // 全て読み捨てられてしまう）。
    if (licenseCategory === "construction" && !record.grantDateIso) continue;

    // ...client組み立ては無変更...

    const license = { licenseId: record.licenseId || DEFAULT_LICENSE_ID, licenseCategory };
    if (record.grantDateIso) license.grantDateIso = record.grantDateIso;
    if (record.licenseType) license.licenseType = record.licenseType;
    client.licenses.push(license);
  }
  // ...
}
```

古物商許可固有の `kobutsuDetail`（4.4節）はCSVの列としては持たせない
（本フェーズのCSVはバックアップ・一括登録用の簡易フォーマットという
既存の位置づけを踏襲し、複雑な入れ子構造は対象外とする。古物商許可の
詳細情報はJSON側でのみ管理する）。

### 5.6 `src/licenses/construction/index.js`（新規）

建設業許可アドオンを起動時にコアへ登録するエントリポイント。

```js
/**
 * 建設業許可アドオンをコアへ登録する。CLIスクリプト（scripts/*.js）・
 * Webサーバ（src/web/server.js）の起動時に、他のimportより先に
 * この関数を呼ぶこと（呼び忘れるとリマインドが生成されなくなる）。
 */
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcRenewalSchedule } from "./reminders/renewalSchedule.js";

export function registerConstructionLicense() {
  registerScheduleFn("construction", (license) => {
    if (!license.grantDateIso) return [];
    const schedule = calcRenewalSchedule(license.grantDateIso);
    return [
      { type: "renewal-early-notice", label: "更新準備の早期検討（満了180日前）", dueDateIso: schedule.earlyNoticeDate },
      { type: "renewal-prepare", label: "更新準備開始の推奨日（満了60日前）", dueDateIso: schedule.recommendedStartDate },
      { type: "renewal-deadline", label: "更新申請の最終締切（満了30日前）", dueDateIso: schedule.hardDeadline },
    ];
  });
}
```

既存の `scripts/*.js`・`src/web/server.js` の冒頭に
`registerConstructionLicense()` の呼び出しを追加する（唯一、既存起動
スクリプトに手を入れる箇所）。

### 5.7 `src/licenses/kobutsu/eligibility/kekkaku.js`（新規）

```js
/**
 * 古物営業法第4条の欠格事由を判定する（一号〜九号。十号・十一号は
 * 対象外。docs/DESIGN_kobutsu-core.md 4.3節・
 * docs/REQUIREMENTS_kobutsu-core.md 8.1節参照）。
 * 参照: e-Gov法令検索「古物営業法」第4条（2026年9月に原文確認済み）
 * https://laws.e-gov.go.jp/law/324AC0000000108
 *
 * @param {import('./types.js').KobutsuKekkakuInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKobutsuKekkaku(input) {
  const reasons = [];
  const flags = [
    [input.isUndischargedBankrupt, "破産手続開始の決定を受けて復権を得ていません"],
    [input.hasCriminalRecordWithin5Years, "拘禁刑以上の刑等により5年を経過していません"],
    [input.hasBoryokuFuhouKoiRisk, "集団的・常習的な暴力的不法行為等のおそれがあると認められます"],
    [input.hasBoryokudanRelatedOrderWithin3Years, "暴力団関連の命令・指示を受けてから3年を経過していません"],
    [input.isAddressUnknown, "住居が定まっていません"],
    [input.hadLicenseRevokedWithin5Years, "許可の取消しから5年を経過していません"],
    [
      input.hasSurrenderedLicenseDuringRevocationHearingWithin5Years,
      "許可取消しの聴聞公示後に許可証を返納してから5年を経過していません",
    ],
    [input.hasMentalImpairmentAffectingDuties, "心身の故障により業務を適正に行うことができないと認められます"],
    [
      input.isMinorWithoutCapacity && !input.isHeirWithQualifiedLegalRepresentative,
      "未成年者であり、例外規定（古物商・古物市場主の相続人としての例外）にも該当しません",
    ],
  ];
  const anyDisqualifying = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(message);
  }
  if (!anyDisqualifying) reasons.push("欠格事由に該当する項目はありません");

  return {
    key: "kobutsuKekkaku",
    label: "欠格事由に該当しないこと",
    passed: !anyDisqualifying,
    reasons,
    warnings: [],
  };
}
```

（`checkKekkaku.js`（建設業許可）と同様、フラグ配列を回して理由文を
組み立てるパターンを踏襲している。）

### 5.8 `src/licenses/kobutsu/eligibility/eigyosho.js`（新規）

```js
/**
 * 営業所・管理者要件（古物営業法第13条）を判定する。営業所単位の入力配列を
 * まとめて判定する点は、建設業許可の senninGijutsusha.js（専任技術者の
 * 営業所単位判定）と同じ構造。
 *
 * @param {import('./types.js').KobutsuEigyoshoInput[]} eigyoshoList
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkKobutsuEigyosho(eigyoshoList) {
  const reasons = [];
  const warnings = [];
  let allPassed = true;

  for (const office of eigyoshoList) {
    if (!office.hasLegitimateUsageRight) {
      allPassed = false;
      reasons.push(`${office.officeName}: 営業所の実在性・使用権限が未確認です`);
    }
    if (!office.managerName) {
      allPassed = false;
      reasons.push(`${office.officeName}: 管理者が選任されていません`);
    } else if (!office.isManagerFullTime) {
      warnings.push(`${office.officeName}: 管理者（${office.managerName}）の常勤性を確認してください`);
    }
  }
  if (allPassed) reasons.push("全営業所で使用権限の確認・管理者の選任ができています");

  return {
    key: "kobutsuEigyosho",
    label: "営業所・管理者の要件",
    passed: allPassed,
    reasons,
    warnings,
  };
}
```

### 5.9 `src/licenses/kobutsu/eligibility/engine.js`（新規）

```js
import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkKobutsuKekkaku } from "./kekkaku.js";
import { checkKobutsuEigyosho } from "./eigyosho.js";

/**
 * @param {import('./types.js').KobutsuApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateKobutsuEligibility(profile) {
  const checks = [checkKobutsuKekkaku(profile.kekkaku), checkKobutsuEigyosho(profile.eigyoshoList)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
  // 古物商許可の整合性チェック（建設業許可のconsistencyChecks.js相当）は
  // 本フェーズでは実装しない（要件定義書スコープ外。必要になれば
  // src/licenses/kobutsu/eligibility/consistencyChecks.js を追加する）
}

/**
 * @param {import('./types.js').KobutsuApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatKobutsuEligibilityReport(profile, result) {
  const lines = [`# 古物商許可 要件判定結果 — ${profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
  }
  return lines.join("\n");
}
```

### 5.10〜5.12 古物商許可 書類生成モジュール（新規）

建設業許可の `youshiki1.js` と同じ3関数パターン（`resolve<様式名>Rows` /
`build<様式名>Document` / `write<様式名>Docx`）を踏襲する。3様式とも
ほぼ同型のため、`shinseisho.js` のみ例示する（`seiyakusho.js`・
`rirekisho.js` も同じパターンで実装する）。

```js
// src/licenses/kobutsu/documents/shinseisho.js
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";

/**
 * @param {import('../eligibility/types.js').KobutsuApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveShinseishoRows(profile) {
  return [
    ["申請者氏名", orNotEntered(profile.applicantName)],
    ["住所", orNotEntered(profile.address)],
    ["屋号", orNotEntered(profile.businessName)],
    ["営業所", orNotEntered(profile.eigyoshoList?.map((e) => e.officeName).join("、"))],
    ["取り扱う古物の区分", orNotEntered(profile.handledItemCategories?.join("、"))],
    ["インターネット利用の有無", profile.usesInternet ? "あり" : "なし"],
    ["URL（該当する場合）", orNotEntered(profile.url)],
  ];
}

export function buildShinseishoDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("古物商許可申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveShinseishoRows(profile)),
        ],
      },
    ],
  });
}

export async function writeShinseishoDocx(profile, outPath) {
  await writeDocxFile(buildShinseishoDocument(profile), outPath);
}
```

`seiyakusho.js`（誓約書）は欠格事由に該当しない旨の誓約文言＋署名欄相当
の表、`rirekisho.js`（略歴書）は `profile.representativeHistory` を
本文段落として出力する構成を想定する（様式確定後、要件定義書FR-K2.6の
対象警察署様式に合わせて表の項目を調整すること）。

### 5.13 `src/licenses/kobutsu/reminders/changeSchedule.js`（新規）

```js
/**
 * 古物商許可の「書換申請」「返納」の期限計算、および変更届出の
 * 即時警告メッセージを提供する。建設業許可の renewalSchedule.js と異なり、
 * 起点は「許可日」ではなく「変更・廃業という出来事の発生日」である点に注意。
 *
 * 参照: docs/REQUIREMENTS_kobutsu-core.md 8.4節（要一次資料確認）
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 記載事項変更日から、書換申請の期限（14日後）を計算する。
 * 月単位の丸め（addMonthsClamped）は不要な、単純な暦日加算。
 * @param {string} changeDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcShokanShinseiDeadline(changeDateIso) {
  return addDaysIso(changeDateIso, 14);
}

/**
 * 廃業日から、許可証返納の期限（10日後）を計算する。
 * @param {string} closureDateIso YYYY-MM-DD
 * @returns {string}
 */
export function calcHenoukiDeadline(closureDateIso) {
  return addDaysIso(closureDateIso, 10);
}

/**
 * 記載事項以外の変更を入力した際に、即座に表示する警告メッセージを返す。
 * リマインド一覧（数日〜数ヶ月単位の定期確認を前提とする既存の
 * bucketizeAlerts）には含めない設計判断について、
 * docs/REQUIREMENTS_kobutsu-core.md FR-K3.4を参照。
 * @returns {string}
 */
export function buildHenkoTodokedeWarning() {
  return "※ 記載事項以外の変更（取り扱う古物の区分の追加等）は、事由が発生した日から3日以内に変更届出が必要です。至急、届出の準備をしてください。";
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}
```

### 5.14 `src/licenses/kobutsu/index.js`（新規）

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcShokanShinseiDeadline, calcHenoukiDeadline } from "./reminders/changeSchedule.js";

/**
 * 古物商許可アドオンをコアへ登録する。construction/index.js と同じ役割。
 */
export function registerKobutsuLicense() {
  registerScheduleFn("kobutsu", (license) => {
    const items = [];
    const detail = license.kobutsuDetail;
    if (detail?.lastRecordedChangeDateIso) {
      items.push({
        type: "shokan-shinsei",
        label: "書換申請の期限",
        dueDateIso: calcShokanShinseiDeadline(detail.lastRecordedChangeDateIso),
      });
    }
    if (detail?.closureDateIso) {
      items.push({
        type: "henou",
        label: "許可証の返納期限",
        dueDateIso: calcHenoukiDeadline(detail.closureDateIso),
      });
    }
    return items; // 変更・廃業の記録が無ければ空配列（＝リマインドなし）
  });
}
```

CLIスクリプト（`scripts/generate-kobutsu-*.js` 等、新規追加分）・
将来Webフォームを古物商対応させる場合は、起動時に
`registerConstructionLicense()` と `registerKobutsuLicense()` の
両方を呼ぶこと。

## 6. 移行計画・実装ステップ（リファクタリングの安全な進め方）

コア抽出は「一気に書き換える」のではなく、各ステップの後に必ず
既存テストを全通過させながら小さく進める。

| ステップ | 内容 | 完了条件 | 状態 |
|---|---|---|---|
| Step 0 | 現状の `npm test`（200件）を実行し、ベースラインとして記録する | 全通過 | ✅ 完了 |
| Step 1 | `src/core/documents/common.js` へ `src/documents/common.js` を移動し、既存様式8ファイルのimportパスのみ変更する | `npm test` 全通過（PRを分けて確認） | ✅ 完了（[PR #32]） |
| Step 2 | `src/core/eligibility/aggregate.js` を新設し、`engine.js` の集約部分を差し替える。`src/licenses/construction/eligibility/` へ既存の要件判定一式を移動する | `npm test` 全通過 | ✅ 完了（[PR #33]） |
| Step 3 | `src/core/reminders/scheduleTypes.js`・`src/core/reminders/dateUtils.js`（`daysUntil`の実体）を新設し、`src/licenses/construction/index.js` を追加。`reminderDigest.js` → `src/core/reminders/digest.js` へ移動し、内部ループをプラグイン呼び出しに変更する。`renewalSchedule.js` は`daysUntil`をdateUtils.jsから再エクスポートする形に変更する。既存CLIスクリプト・`src/web/server.js` の起動時に `registerConstructionLicense()` 呼び出しを追加する | `npm test` 全通過。`npm run gen:reminder-digest` の出力がStep 0と一致することを目視確認 | ✅ 完了（[PR #34]） |
| Step 4 | `clientStore.js`・`clientCsv.js` を `src/core/reminders/` へ移動し、`licenseCategory` のデフォルト補完・CSV列追加を行う（5.4節・5.5節の注意点を反映すること） | `npm test` 全通過。既存の `data/clients.json`（旧形式サンプル）を読み込ませ、全許可に `licenseCategory: "construction"` が補われることを確認。古物商許可（`grantDateIso` を持たない）のダミーCSV行を作成し、`clientsFromCsv()` が黙って読み捨てずに正しく取り込めることを確認 | ✅ 完了（[PR #35]） |
| Step 5 | 古物商許可モジュール（要件判定 → 書類生成 → リマインド の順）を新規実装する。既存プロジェクトのM1→M2→M4の順序を踏襲 | 各モジュール追加ごとにユニットテストを追加し全通過 | ✅ 完了（[PR #36]） |
| Step 6 | README・`docs/ARCHITECTURE.md`・本設計書の「実装後の実態」欄を更新する | 受け入れ基準5・6（要件定義書6章）を満たす | ✅ 完了（本PR） |

[PR #32]: https://github.com/satou-aaaaa/sandbox/pull/32
[PR #33]: https://github.com/satou-aaaaa/sandbox/pull/33
[PR #34]: https://github.com/satou-aaaaa/sandbox/pull/34
[PR #35]: https://github.com/satou-aaaaa/sandbox/pull/35
[PR #36]: https://github.com/satou-aaaaa/sandbox/pull/36

実装時にStep 5で判明した、本書のサンプルコードからの小さな差分:
- `eigyosho.js`: 営業所リストが空配列の場合に不合格として明示的なメッセージを
  返すガード節を追加した（建設業許可の`senninGijutsusha.js`と同じ既存パターンを
  踏襲。設計書のサンプルコードには無かったが、動作としては後方互換）

各ステップは独立したPRとして分割することを推奨する（既存の
`DEVELOPMENT_GUIDE.md` 3.2節「機能追加・修正は作業用ブランチを切って
行う」を踏襲）。

## 7. テスト方針

既存の `docs/DESIGN.md` 7章（公開関数の入出力を検証する、法定要件の
分岐網羅を重視する、`node --test` を使う）をそのまま継承する。

新規追加分のテスト観点:

- `aggregateEligibility`: 全要件合格／一部不合格／全要件不合格の3パターン
- `scheduleTypes.js`（レジストリ）: 未登録キーで `getScheduleFn` が
  `undefined` を返すこと、登録後に正しい関数が取れること
- `digest.js`: `licenseCategory` 未設定（＝construction扱い）のレコードで
  既存と同じリマインドが生成されること（回帰確認の要）。`licenseCategory:
  "kobutsu"` かつ `kobutsuDetail` 未設定の場合に空配列（リマインドなし）
  となること
- `clientStore.js` の `licenseCategory` 補完（`applyLicenseCategoryDefault`）:
  本開発以前の形式の `clients.json`（`licenseCategory` キーが無い）を
  読み込んだ際、旧形式（`grantDateIso`直下持ち）・新形式（`licenses`配列
  持ち）**両方の経路**で全許可に `"construction"` が補われること（5.4節の
  設計レビューで判明した「片方の経路にしか適用されない」実装ミスの
  回帰防止）
- `clientCsv.js` の `grantDateIso` 必須チェック: `licenseCategory:
  "kobutsu"` かつ `grantDateIso` 列が空のCSV行が、黙って読み捨てられずに
  正しく取り込まれること（5.5節で判明した見落としの回帰防止）
- `dateUtils.js`（`daysUntil`の移動）: `renewalSchedule.js` からの
  再エクスポート経由でも従来どおり呼び出せること
- `kekkaku.js`: 8.1節で確認した号（一号〜九号）ごとに、該当する場合／
  しない場合のテストを1号につき最低1ケースずつ用意する（第七号・第九号の
  相続人例外を含む。建設業許可の `kekkaku.test.js` と同じ網羅方針）
- `eigyosho.js`: 営業所が1件／複数件、使用権限未確認、管理者未選任、
  管理者非常勤（警告のみ）の各パターン
- `changeSchedule.js`: `calcShokanShinseiDeadline`・`calcHenoukiDeadline` の
  日数計算（月またぎ・年またぎを含む境界値）
- 書類生成3モジュール: ダミーデータからdocxが生成でき、免責注記が
  含まれること（既存の `youshiki1.test.js` 相当のテストパターン）

## 8. 非機能設計

既存の `docs/DESIGN.md` 8章（NFR-1〜7に対応する設計上の配慮）を継承する。
追加の配慮事項:

- コア（`src/core/`）に許可種別固有の文言・法令名を書かないことを、
  セルフレビューチェックリスト（既存の `.github/pull_request_template.md`）
  に項目として追加することを推奨する
- `src/licenses/<種別>/index.js` の登録関数（`registerXxxLicense`）を
  呼び忘れると、その許可種別のリマインドが静かに生成されなくなる
  （エラーにならない）。CLIスクリプト・Webサーバ起動時のチェックとして、
  起動直後に登録済み許可種別の一覧をログ出力する簡易的な確認手段を
  設けることを検討する（必須要件ではないが、実装者の裁量で追加してよい）

## 9. 今後の拡張ポイント（本フェーズ後の検討事項）

- 3つ目以降の許可種別を追加する際、`src/licenses/<新種別>/` を追加し
  `registerScheduleFn` を呼ぶだけで済むかどうかは、古物商許可の実装を
  通じて初めて検証できる。決算変更届のような「クライアント単位の
  追加リマインド」（5.3節で触れた特殊分岐）が2例目・3例目でも
  必要になった場合、コア側に一般化する設計変更を検討する
- 古物商許可の整合性チェック（建設業許可の `consistencyChecks.js` 相当）:
  **2026年9月実装済み**。`eligibility/consistencyChecks.js`
  （生年月日の妥当性・管理者の複数営業所重複・未成年者例外フラグの矛盾）
- 古物商許可のWebフォーム対応（`src/web/` の拡張）
- 法人申請への対応拡大: **2026年9月・欠格事由の判定のみ実装済み**。
  古物営業法第4条11号（法人でその役員のうちに第一号から第八号までの
  いずれかに該当する者があるもの）を確認し、`KobutsuApplicantProfile`に
  `applicantType`・`officers`（役員一覧。第4条1号〜8号のみを持つ
  `KobutsuOfficerInput[]`）を追加、`checkKobutsuKekkaku`が役員ごとの
  該当性もあわせて判定するようにした。法人向けの許可申請書・略歴書
  （役員ごとに1通必要）等、書類生成のフル対応は引き続き対象外
- 変更届（3日以内）の入力時警告（5.13節 `buildHenkoTodokedeWarning`）を、
  将来的に `src/web/` に組み込む際のUI設計（現状はCLI/スクリプト前提の
  ため、警告メッセージを返す関数を用意するのみに留めている）

## 10. 改訂履歴

### v0.2（2026年9月・実装着手前レビュー）

実装着手前に、現行コードとの突き合わせ・e-Gov法令検索原文の確認を行い、
以下を修正した（詳細な理由は各節の「⚠ 設計レビューで判明した」注記参照）。

- 3章: `src/documents/youshiki*.js` の実際のファイル数を「9ファイル」から
  正しい「8ファイル」に訂正
- 4.3節: `KobutsuKekkakuInput` を8章の訂正内容（第七号の追加・第二号の
  「拘禁刑」への訂正・第九号例外の正確な記述）に合わせて修正。
  `KobutsuEigyoshoInput.isManagerFullTime` に、常勤性要件の法的根拠が
  未確認である旨の注記を追加
- 5.3節: `daysUntil` が「コアは許可種別を知らない」という1章の原則に
  反して建設業許可専用パスからimportされていた設計を、
  `src/core/reminders/dateUtils.js` への切り出し＋
  `renewalSchedule.js` からの再エクスポートに変更して解消
- 5.4節: `migrateClientIfNeeded` 内に `licenseCategory` 補完を実装すると
  「既に新形式のデータ」の経路に適用漏れが起きるリスクがあったため、
  `loadClients()` 側の独立した `.map()` ステップ（`applyLicenseCategoryDefault`）
  に切り出す設計に変更
- 5.5節: `clientsFromCsv()` の `grantDateIso` 必須チェックが、
  `grantDateIso` を持たない古物商許可のCSV行を黙って読み捨てて
  しまう見落としを修正（`licenseCategory === "construction"` の場合のみ
  必須にする条件分岐を追加）
- 6章Step 1・Step 3・Step 4: 上記の修正を反映
- 7章: 上記修正点に対応するテスト観点を追加
