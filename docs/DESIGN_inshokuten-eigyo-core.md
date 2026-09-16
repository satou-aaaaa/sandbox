# 設計書 — 飲食店営業許可モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_inshokuten-eigyo-core.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章（コアは許可種別を知らない・既存機能は
無傷で残す）を継承する。本モジュール固有の原則を2つ追加する。

- **「許可要件」と「継続義務」を型・判定ロジックのレベルで混同しない**:
  要件定義書1.3節の通り、HACCPに沿った衛生管理は許可の交付要件ではない。
  `eligibility/` 配下の判定関数群は、施設基準・食品衛生責任者の設置と
  いった**許可要件のみ**を判定対象とし、HACCP関連の入力フィールドを
  `InshokutenApplicantProfile`（3.3節）に一切持たせない。HACCPへの言及は
  すべて「注記・案内文言」としてのみ出力に含める（3.4節の
  `HACCP_CONTINUING_OBLIGATION_NOTICE`）。判定結果の`passed`計算に
  HACCP関連フラグを含めてしまうと、要件定義書NFR-I1が求める「要件では
  なく継続義務」という区別が型の設計段階で崩れるため、コードレビュー時に
  この点を確認する
- **可変期間リマインドの「第三のパターン」を実証する**: `docs/
  DESIGN_kobutsu-core.md`が確立した`ScheduleFn`契約（`LicenseEntry`から
  `ScheduleItem[]`を返す）は、建設業許可・産廃許可の「固定5年・起点から
  計算」、技人国ビザの「満了日を直接入力として受け取る」に続き、本
  モジュールの「起点（許可年月日）＋可変の年数（5〜8年）から計算する」
  という第三のパターンにも、コア側を一切変更せずに対応できることを
  確認する（4.3節）

## 2. 全体アーキテクチャ

```
src/licenses/inshokuten-eigyo/
  eligibility/
    types.js
    shisetsuKijun.js   ← 施設基準（厨房・換気・給排水・手洗い設備等）
    sekininsha.js        ← 食品衛生責任者の設置要件
    engine.js
  documents/
    shinseishoSummary.js ← 営業許可申請書サマリー
    tenpuChecklist.js      ← 添付書類・流れの案内チェックリスト
  reminders/
    koshinSchedule.js      ← 可変期間（5〜8年）の更新満了リマインド
  index.js
```

既存モジュールと同様、`src/core/`（コア）は本モジュールの存在を一切
知らない。コアへの接続点は`index.js`の`registerInshokutenEigyoLicense()`
（5章）のみである。

## 3. データモデル

### 3.1 `eligibility/types.js`（新設）

```js
/**
 * @typedef {Object} ShisetsuKijunInput 施設基準の判定に使う入力
 *   食品衛生法施行条例上の基準項目は自治体により差異があるため、
 *   以下は代表的な基準セット（要件定義書NFR-I2）を暫定的に整理した
 *   ものであり、対象自治体の一次資料確認後に項目を調整すること。
 * @property {number} sinkCount 洗浄・すすぎ用のシンクの数（2槽以上が目安）
 * @property {boolean} hasNonTouchHandwashing 手洗い設備が「洗浄後の手指の再汚染を防止できる構造」（レバー式・肘操作式・自動センサー式等）か。ひねる水栓のみの場合はfalse
 * @property {boolean} hasWashableWallFloorMaterial 床・壁・天井が耐水性・清掃しやすい材質か
 * @property {boolean} hasAdequateVentilation 適切な換気設備があるか
 * @property {number} [lightingLux] 調理場の照度（ルクス）。基準値は自治体により異なる（目安150ルクス以上）
 * @property {boolean} hasProperDrainage 適切な給排水設備・グリストラップがあるか
 * @property {boolean} usesTankOrWellWater 貯水槽水・井戸水を使用するか（trueの場合、水質検査が必要）
 * @property {boolean} [hasWaterQualityTestReport] 水質検査成績書を準備済みか（usesTankOrWellWaterがtrueの場合のみ確認）
 */

/**
 * @typedef {Object} SekininshaInput 食品衛生責任者の設置要件の判定に使う入力
 * @property {string} name 食品衛生責任者の氏名
 * @property {"調理師" | "製菓衛生師" | "栄養士" | "講習会受講修了" | "未定"} qualificationType 資格の種別
 * @property {boolean} isDesignatedPerStore 当該店舗専属で設置されているか（既存資格による免除の場合も、店舗ごとの設置は必須）
 */
```

### 3.2 コア`LicenseEntry`の拡張（`src/core/reminders/clientStore.js`側）

```js
/**
 * @typedef {Object} InshokutenLicenseDetail LicenseEntry.inshokutenDetail の中身
 * @property {string} [municipalityName] 許可を交付した自治体名（保健所設置市・特別区・都道府県等）
 * @property {string} [grantDateIso] 許可年月日（YYYY-MM-DD）。満了日計算の起点
 * @property {number} [validityYears] 有効期間年数（5〜8が目安。自治体・施設により異なり、許可証交付時に個別に決定される。要件定義書1.3節の通り、許可前には確定しないため許可証交付後に入力する）
 * @property {string} [responsiblePersonName] 食品衛生責任者の氏名（変更があった場合は最新の氏名に更新する）
 * @property {string} [lastRenewalDateIso] 直近の更新（更新許可申請が受理された）年月日。任意
 */
```

`LicenseEntry.licenseCategory`に`"inshokuten-eigyo"`を追加する。既存の
`kobutsuDetail`・`gijinkokuDetail`と同様、`inshokutenDetail`は当該許可
種別のときのみ使用するオプショナルフィールドとし、コア側は中身を一切
解釈しない（`docs/DESIGN_kobutsu-core.md` 4.2節の設計方針を踏襲）。

### 3.3 `InshokutenApplicantProfile`（申請者の総合入力データ）

```js
/**
 * @typedef {Object} InshokutenApplicantProfile 申請の総合入力データ
 *   HACCP関連のフィールドは意図的に持たせない（1章の設計原則参照）。
 * @property {string} applicantName 申請者（営業者）氏名または法人名
 * @property {string} [businessName] 屋号（店舗名）
 * @property {string} storeAddress 営業所（店舗）所在地
 * @property {string} municipalityName 管轄保健所の自治体名
 * @property {string} [phoneNumber] 電話番号
 * @property {ShisetsuKijunInput} shisetsu
 * @property {SekininshaInput} sekininsha
 * @property {string} [plannedOpeningDateIso] 開業予定日（任意。案内文書の目安計算に使用）
 */
```

### 3.4 HACCP継続義務の注記（本モジュール専用）

```js
// src/licenses/inshokuten-eigyo/eligibility/disclaimer.js

/**
 * HACCPに沿った衛生管理が「許可要件ではなく継続義務」であることを
 * 明示する注記。判定レポート・生成書類の両方に必ず付加する
 * （要件定義書FR-I1.5・FR-I2.4・NFR-I1）。
 * `docs/DESIGN_gijinkoku-core.md` 4.2節の`GIJINKOKU_SCREENING_NOTICE`
 * と同じ「コアの共通ヘルパーをそのまま使わず、本モジュール専用の
 * 文言関数でラップする」構成を踏襲する。
 */
export const HACCP_CONTINUING_OBLIGATION_NOTICE =
  "※ HACCPに沿った衛生管理（またはHACCPの考え方を取り入れた衛生管理）の" +
  "実施は、飲食店営業許可の交付要件ではありません。許可取得後に、原則" +
  "すべての事業者に義務付けられる継続的な衛生管理です。本判定結果が" +
  "「○」であっても、HACCPに沿った衛生管理計画の策定・記録は別途必要と" +
  "なりますので、開業後速やかに対応してください。";
```

## 4. モジュール詳細設計

### 4.1 `eligibility/shisetsuKijun.js`・`sekininsha.js`

```js
/**
 * @param {import('./types.js').ShisetsuKijunInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkShisetsuKijun(input) {
  const reasons = [];
  const warnings = [];
  const flags = [
    [input.sinkCount < 2, "シンクが2槽未満です（2槽以上が目安）"],
    [!input.hasNonTouchHandwashing, "手洗い設備が「洗浄後の手指の再汚染を防止できる構造」になっていません（ひねる水栓のみは不可）"],
    [!input.hasWashableWallFloorMaterial, "床・壁・天井が耐水性・清掃しやすい材質になっていません"],
    [!input.hasAdequateVentilation, "適切な換気設備が確認できません"],
    [!input.hasProperDrainage, "適切な給排水設備・グリストラップが確認できません"],
  ];
  const anyFailing = flags.some(([flag]) => flag);
  for (const [flag, message] of flags) {
    if (flag) reasons.push(message);
  }
  if (input.usesTankOrWellWater && !input.hasWaterQualityTestReport) {
    warnings.push("貯水槽水・井戸水を使用するため、水質検査成績書の準備状況を確認してください");
  }
  if (!anyFailing) reasons.push("施設基準の主要項目はすべて満たしています");

  return {
    key: "shisetsuKijun",
    label: "施設基準（厨房・換気・給排水・手洗い設備等）",
    passed: !anyFailing,
    reasons,
    warnings,
  };
}

/**
 * @param {import('./types.js').SekininshaInput} input
 * @returns {import('../../../core/eligibility/types.js').RequirementCheckResult}
 */
export function checkSekininsha(input) {
  const reasons = [];
  let passed = true;

  if (!input.name || input.qualificationType === "未定") {
    passed = false;
    reasons.push("食品衛生責任者が未設置、または資格の種別が未定です");
  } else if (input.qualificationType === "講習会受講修了") {
    reasons.push(`${input.name}氏（講習会受講修了）を食品衛生責任者として設置予定です`);
  } else {
    reasons.push(`${input.name}氏（${input.qualificationType}資格による講習免除）を食品衛生責任者として設置予定です`);
  }
  if (passed && !input.isDesignatedPerStore) {
    passed = false;
    reasons.push("食品衛生責任者は店舗ごとの専属設置が必要です");
  }

  return {
    key: "sekininsha",
    label: "食品衛生責任者の設置",
    passed,
    reasons,
    warnings: [],
  };
}
```

### 4.2 `eligibility/engine.js`

```js
import { aggregateEligibility, formatChecksSection } from "../../../core/eligibility/aggregate.js";
import { checkShisetsuKijun } from "./shisetsuKijun.js";
import { checkSekininsha } from "./sekininsha.js";
import { HACCP_CONTINUING_OBLIGATION_NOTICE } from "./disclaimer.js";

/**
 * @param {import('./types.js').InshokutenApplicantProfile} profile
 * @returns {import('../../../core/eligibility/types.js').EligibilityResult}
 */
export function evaluateInshokutenEligibility(profile) {
  const checks = [checkShisetsuKijun(profile.shisetsu), checkSekininsha(profile.sekininsha)];
  const { eligible, blockingIssues } = aggregateEligibility(checks);
  return { eligible, checks, blockingIssues };
  // 水質検査・整合性チェック等、施設基準以外の細部は本フェーズでは
  // checkShisetsuKijunのwarningsに留め、専用モジュールへの分離は
  // 9章「今後の拡張ポイント」で再検討する
}

/**
 * @param {import('./types.js').InshokutenApplicantProfile} profile
 * @param {import('../../../core/eligibility/types.js').EligibilityResult} result
 * @returns {string}
 */
export function formatInshokutenEligibilityReport(profile, result) {
  const lines = [`# 飲食店営業許可 要件判定結果 — ${profile.businessName ?? profile.applicantName}`, ""];
  lines.push(`総合判定: ${result.eligible ? "○ 施設基準・食品衛生責任者の要件を充足（申請準備を進められます）" : "× 未充足の要件があります"}`, "");
  lines.push(...formatChecksSection(result.checks));
  if (!result.eligible) {
    lines.push("## 未充足の要因まとめ");
    for (const issue of result.blockingIssues) lines.push(`- ${issue}`);
    lines.push("");
  }
  lines.push(HACCP_CONTINUING_OBLIGATION_NOTICE);
  return lines.join("\n");
}
```

### 4.3 `reminders/koshinSchedule.js`（可変期間型・第三のパターン）

```js
/**
 * 許可年月日＋自治体・施設ごとに異なる有効期間年数（5〜8年）から
 * 満了日を計算し、更新関連のリマインド日を算出する。
 *
 * 建設業許可・産廃許可のcalcRenewalScheduleは「5年固定」を前提に
 * しており、技人国ビザのcalcZairyuKikanScheduleは「満了日そのものを
 * 入力として受け取る」方式だった。本モジュールはその中間、すなわち
 * 「起点（許可年月日）は分かっているが、そこに加える年数が許可ごとに
 * 異なる」という第三のパターンに当たる。年数を引数として受け取れる
 * ようcalcRenewalSchedule相当のロジックを汎用化した形になっている。
 *
 * 参照: docs/REQUIREMENTS_inshokuten-eigyo-core.md 1.3節・4.3節
 *   （有効期間は許可証交付後に確定するため、許可前の見込みからの
 *   自動計算は行わない設計とした背景）
 *
 * @param {import('../../../core/reminders/clientStore.js').LicenseEntry} license
 *   license.inshokutenDetail.grantDateIso と .validityYears を入力として使う
 * @returns {import('../../../core/reminders/scheduleTypes.js').ScheduleItem[]}
 */
export function calcInshokutenKoshinSchedule(license) {
  const detail = license.inshokutenDetail;
  if (!detail?.grantDateIso || !detail?.validityYears) return [];

  const expiryDateIso = addYearsClamped(detail.grantDateIso, detail.validityYears);
  return [
    { type: "koshin-early-notice", label: `更新準備の早期検討（満了90日前・有効期間${detail.validityYears}年）`, dueDateIso: addDaysIso(expiryDateIso, -90) },
    { type: "koshin-prepare", label: "更新準備開始の推奨日（満了60日前）", dueDateIso: addDaysIso(expiryDateIso, -60) },
    { type: "koshin-deadline", label: "更新申請の目安締切（満了1か月前）", dueDateIso: addMonthsClamped(expiryDateIso, -1) },
  ];
}

/**
 * 許可年月日にvalidityYears年を加えた満了日を計算する（うるう年の
 * 2/29起点等、月末日のクランプが必要なケースはaddMonthsClampedと
 * 同じ考え方で吸収する）。
 * @param {string} grantDateIso YYYY-MM-DD
 * @param {number} years
 * @returns {string}
 */
function addYearsClamped(grantDateIso, years) {
  return addMonthsClamped(grantDateIso, years * 12);
}

/** @param {string} iso @param {number} months 月単位で加算し、月末日をクランプする */
function addMonthsClamped(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDayOfTargetMonth));
  return target.toISOString().slice(0, 10);
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}
```

**設計上のポイント**: `calcInshokutenKoshinSchedule`は`license`
（`LicenseEntry`）そのものを受け取り、内部で`inshokutenDetail`から
`grantDateIso`・`validityYears`を取り出す。これは技人国ビザの
`calcZairyuKikanSchedule`と同じ「`ScheduleFn`は`LicenseEntry`を丸ごと
受け取る」という契約に合わせたものであり、コア側（`scheduleTypes.js`の
`ScheduleFn`型）の変更は一切不要だった。`validityYears`が未入力
（＝許可証交付前でまだ年数が確定していない）の場合は空配列を返し、
リマインドを生成しない（古物商許可の「変更記録が無ければ空配列」と
同じ設計判断）。

### 4.4 `documents/shinseishoSummary.js`・`tenpuChecklist.js`

建設業許可の`youshiki1.js`・古物商許可の`shinseisho.js`と同じ3関数
パターン（`resolve<様式名>Rows` / `build<様式名>Document` /
`write<様式名>Docx`）を踏襲する。

```js
// src/licenses/inshokuten-eigyo/documents/shinseishoSummary.js
import { Document } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../../core/documents/common.js";
import { HACCP_CONTINUING_OBLIGATION_NOTICE } from "../eligibility/disclaimer.js";

/**
 * @param {import('../eligibility/types.js').InshokutenApplicantProfile} profile
 * @returns {[string, string][]}
 */
export function resolveShinseishoSummaryRows(profile) {
  return [
    ["申請者（営業者）氏名", orNotEntered(profile.applicantName)],
    ["屋号", orNotEntered(profile.businessName)],
    ["営業所所在地", orNotEntered(profile.storeAddress)],
    ["管轄自治体（保健所）", orNotEntered(profile.municipalityName)],
    ["食品衛生責任者", orNotEntered(profile.sekininsha?.name)],
    ["資格の種別", orNotEntered(profile.sekininsha?.qualificationType)],
    ["開業予定日", orNotEntered(profile.plannedOpeningDateIso)],
  ];
}

export function buildShinseishoSummaryDocument(profile) {
  return new Document({
    sections: [
      {
        properties: A4_PAGE_PROPERTIES,
        children: [
          buildTitleHeading("飲食店営業許可申請書 — 申請内容サマリー"),
          buildDisclaimerParagraph(),
          buildLabeledTable(resolveShinseishoSummaryRows(profile)),
          buildDisclaimerParagraph(HACCP_CONTINUING_OBLIGATION_NOTICE),
        ],
      },
    ],
  });
}

export async function writeShinseishoSummaryDocx(profile, outPath) {
  await writeDocxFile(buildShinseishoSummaryDocument(profile), outPath);
}
```

`tenpuChecklist.js`は、要件定義書FR-I2.2・FR-I2.3の通り、添付書類
（施設図面、水質検査成績書〈該当時のみ〉、食品衛生責任者資格証明書等）
と、事前相談→工事着工→申請書提出（施設完成10〜14日前目安）→実地検査
（営業者立会い必須）→許可証交付、という標準的な流れの案内をチェック
リスト形式の表として出力する構成を想定する（自治体固有の提出目安日数・
手数料は、実装時に対象自治体の一次資料で確定させ、`profile.
municipalityName`に応じて文言を差し替えられる余地を残す）。

## 5. `index.js`（registerScheduleFn登録）

```js
import { registerScheduleFn } from "../../core/reminders/scheduleTypes.js";
import { calcInshokutenKoshinSchedule } from "./reminders/koshinSchedule.js";

/**
 * 飲食店営業許可アドオンをコアへ登録する。construction/index.js・
 * kobutsu/index.js・gijinkoku/index.jsと同じ役割。
 */
export function registerInshokutenEigyoLicense() {
  registerScheduleFn("inshokuten-eigyo", calcInshokutenKoshinSchedule);
}
```

CLIスクリプト（`scripts/generate-inshokuten-*.js`等、新規追加分）・
将来Webフォームを本モジュール対応させる場合は、起動時に既存の
`registerConstructionLicense()`・`registerKobutsuLicense()`・
`registerGijinkokuModule()`とあわせて`registerInshokutenEigyoLicense()`
も呼ぶこと（呼び忘れるとリマインドが静かに生成されなくなる。
`docs/DESIGN_kobutsu-core.md` 8章の既知の注意点と同じ）。

## 6. 実装ステップ

1. `eligibility/`（施設基準→食品衛生責任者→統合エンジン。HACCP注記を
   最初から組み込む）
2. `documents/`（申請書サマリー→添付書類・流れ案内チェックリスト）
3. `reminders/`（可変期間の満了リマインド→`index.js`登録）
4. 有効期間5年・6年・7年・8年のそれぞれで、満了日・リマインド日が
   正しく計算されることをCLIで確認する（境界値として、うるう年の
   2/29に許可が下りたケースを含める）
5. README・`docs/ARCHITECTURE.md`の対応許可種別一覧を更新する

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章を継承。追加観点:

- `checkShisetsuKijun`: 全項目充足／一部不足（シンク数不足・手洗い設備
  構造不適合・材質不適合・換気不足・給排水不足）の各パターン、および
  貯水槽水・井戸水使用時に水質検査成績書が未準備の場合に警告が出る
  こと（`passed`には影響しないことを確認する）
- `checkSekininsha`: 資格種別ごと（調理師・製菓衛生師・栄養士・講習会
  受講修了・未定）の判定、店舗専属設置でない場合に不充足となること
- `formatInshokutenEligibilityReport`: 出力に必ず
  `HACCP_CONTINUING_OBLIGATION_NOTICE`が含まれること（NFR-I1の担保。
  `eligible`が`true`の場合・`false`の場合の両方で確認する）
- `calcInshokutenKoshinSchedule`: 有効期間5年・6年・7年・8年それぞれで
  満了日・90日前・60日前・1か月前のリマインドが正しく計算されること。
  `validityYears`未設定（許可証交付前）の場合に空配列を返すこと。
  うるう年（2/29許可）を起点にした年数加算で日付がクランプされること
  （2/29起点＋非うるう年到達時に2/28へ丸まること）
- `clientStore.js`: `inshokutenDetail`を持つ`LicenseEntry`を
  `upsertClientLicense`で登録・取得できること（既存の
  `licenseCategory`デフォルト補完ロジックに影響しないこと）
- 書類生成2モジュール: ダミーデータからdocxが生成でき、免責注記・
  HACCP注記の両方が含まれること

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章を継承。追加の配慮事項:

- HACCP関連のフィールドを`eligibility/types.js`の型に一切持たせない
  ことを、セルフレビューチェックリストの項目として追加することを
  推奨する（1章の設計原則の型レベルでの担保）
- 施設基準の具体的な数値基準を自治体ごとにハードコードしないこと
  （要件定義書NFR-I2）。本フェーズは代表的基準セット1種類の実装に
  留め、自治体差分のデータ化は9章の拡張ポイントとする
- 食品衛生責任者の氏名等、個人情報を含むため、既存NFR-4（外部送信
  禁止）を遵守する

## 9. 今後の拡張ポイント（本フェーズ後の検討事項）

- 施設基準条例の自治体別データベース化（`prefectureRules.js`と同じ
  レジストリパターンの応用。NFR-I2で本フェーズは対象外とした部分）
- 深夜酒類提供飲食店営業届出（風俗営業法）との連携（要件定義書4.6節
  スコープ外。飲食店営業許可取得後に深夜酒類提供を行う依頼者向けの
  案内機能として、別モジュール化を検討する）
- 酒類販売業免許（酒税法）モジュールとの連携（店内提供のみでなく
  酒類の物販を行う依頼者向け）
- HACCPに沿った衛生管理の実施計画書テンプレート生成支援（1.3節の
  通り本フェーズは対象外としたが、許可取得後のフォローアップ
  サービスとして別モジュール化する余地がある）
- 複数店舗展開時、店舗ごとに異なる自治体・有効期間年数を持つ
  `LicenseEntry`群を一覧・一括管理するダッシュボード機能
  （要件定義書FR-I3.3を土台とした拡張）
- 更新時の図面再提出要否（店舗構造変更の有無）を入力として受け取り、
  再提出が必要な場合のみ添付書類チェックリストに図面を含める、
  より精緻な`tenpuChecklist.js`の条件分岐
