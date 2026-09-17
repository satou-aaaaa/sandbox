# 設計書 — 相続関連（遺言書・遺産分割協議書）支援モジュール

version: 0.1 / 2026-09 作成
対応する要件定義書: `docs/REQUIREMENTS_souzoku-support.md`
前提となるコア設計: `docs/DESIGN_kobutsu-core.md`
参照する先行実装例: `docs/DESIGN_uketsuke-portal.md`（コアのレジストリを使わない独立ドメインの設計例）

## 1. 設計原則

`docs/DESIGN_kobutsu-core.md` 1章（ビルドレス構成・テストファースト・
人手レビュー必須・小さく作って検証する）をすべて継承する。加えて、
本モジュール固有の原則を4つ追加する。

### 1.1 `src/licenses/<種別>/` には置かない（許可アドオンではない）

本モジュールは、これまでの許可種別アドオン（建設業・古物商・産廃・
民泊・在留資格）とは異なり、「許可」を対象にしていない。相続人・
相続分の計算は、ある個人が「許可を取得できるか」を判定するものでは
なく、複数の相続人の間で「財産をどう分けるか」を計算するものである。
このため `src/licenses/succession/` のような形では配置せず、
`docs/DESIGN_uketsuke-portal.md` が確立した先例にならい、
`src/succession/` という**独立した業務ドメイン**として配置する（2章）。

### 1.2 コアの `registerScheduleFn` レジストリを使わない理由

`docs/DESIGN_kobutsu-core.md`で設計した`registerScheduleFn`は、
「`LicenseEntry`を1件受け取り、`ScheduleItem[]`を返す」という契約に
なっており、これは「許可」という単位を前提にしている。本モジュールが
管理する単位は「相続案件（`SuccessionCaseRecord`）」であり、これを
無理やり`LicenseEntry`として扱おうとすると、`licenseCategory`に
`"succession"`のような不自然な値を持たせることになり、コア設計の
一貫性（「コアは許可種別を知らない」原則）が崩れる。これは
`docs/DESIGN_uketsuke-portal.md` 5章で示した判断（`CaseRecord`を
`LicenseEntry`化しない）と全く同じ理由であり、本モジュールで2例目の
確認になる。

そのため本モジュールは、コアの**型・レジストリには一切触れず**、
`src/core/documents/common.js`（docx共通ヘルパー）と、
`src/core/reminders/digest.js`が提供する**表示用の関数**
（`bucketizeAlerts`・`formatReminderDigest`・`REMINDER_RANGES`）
だけを再利用する（5章）。

### 1.3 コアの判定型（`RequirementCheckResult`/`EligibilityResult`）も使わない理由

これまでのアドオンは、要件判定エンジンの成果物である
「合否＋理由リスト」という`RequirementCheckResult`型に、判定内容
（欠格事由の有無・営業所要件等）を落とし込んできた。本モジュールが
計算する「法定相続人・法定相続分」は、合否ではなく**分配**であり、
`passed: boolean`という形には自然に収まらない（「配偶者は法定相続人か」
は常にYes/Noで答えられる話ではなく、「配偶者の相続分は何分の何か」を
answerする必要がある）。無理に`RequirementCheckResult`へ押し込めると、
`passed`フィールドの意味が曖昧になり、かえって可読性を損なう。

このため、本モジュールは`aggregateEligibility`等の集約ロジックを
使わず、独自の結果型`LegalHeirsResult`を新設する（3章）。ただし
「機械的なルールに基づき、入力から**理由・根拠付きの結果**を返す」
という要件判定エンジンの設計思想そのもの（`warnings`配列による
人手確認の明示等）は踏襲する。これが要件定義書0章で述べた
「要件判定エンジンの考え方の転用」の具体的な中身である。

### 1.4 職域を超える判断は自動化しない（`seijitsusei.js`と同じ考え方）

建設業許可モジュールの`seijitsusei.js`（誠実性の要件を自己申告＋警告
に留める）、技人国モジュールの`kanrensei.js`（専攻と職務の関連性を
自己申告＋警告に留める）と同じ設計思想を、本モジュールでは以下の
3箇所に適用する。

- 相続人間の**争いの有無**（`SuccessionCaseRecord.hasDisputeAmongHeirs`）
  は自動判定せず、発注者が人手で確認した結果をフラグとして記録する
  入力項目とする。真の場合、協議書生成前に職域外警告を強く表示する（4章）
- **遺留分侵害の該当性**は、法定相続分の1/2（または1/3）を下回るかの
  機械的な目安計算に留め、確定判定はしない（4章）
- **同時死亡の推定・養子縁組の有無・内縁関係の扱い**等、入力の正確性
  そのものに関わる事項は、`calcLegalHeirs`の`warnings`に必ず人手確認を
  促す文言を含める（4章）

## 2. 全体アーキテクチャ

```
src/succession/
  types.js                     ← HeirCandidateInput / FamilyStructureInput /
                                   SuccessionCaseRecord / PropertyItem 等（3章）
  heirs/
    fraction.js                 ← 既約分数ユーティリティ（内部専用。4.1節）
    calcLegalHeirs.js            ← 法定相続人・法定相続分の計算（本設計の中核。4.2節）
  documents/
    zaisanMokuroku.js             ← 財産目録サマリー（4.3節）
    isanBunkatsuKyogisho.js        ← 遺産分割協議書サマリー（4.3節）
    jihitsushoshoYuigon.js          ← 自筆証書遺言 文案（4.3節）
  reminders/
    souzokuDeadlines.js              ← 相続放棄・相続税申告・遺留分侵害額請求の
                                         期限計算（5章）
  caseStore.js                        ← SuccessionCaseRecordの永続化
                                          （data/succession-cases.json。4.4節）
  index.js                              ← （コアへの登録は行わない。1.2節参照）
```

`src/licenses/`配下には何も置かない（1.1節）。`src/core/`配下にも
相続関連の概念を一切持ち込まない（`docs/DESIGN_kobutsu-core.md`の
「コアは許可種別を知らない」原則を拡張した「コアは相続業務のことも
知らない」を維持する）。

再利用するコアのモジュール:

| コアのモジュール | 再利用する関数 | 再利用しないもの |
|---|---|---|
| `src/core/documents/common.js` | `A4_PAGE_PROPERTIES`・`buildTitleHeading`・`buildDisclaimerParagraph`・`buildLabeledTable`・`orNotEntered`・`writeDocxFile` | （全面再利用） |
| `src/core/reminders/digest.js` | `bucketizeAlerts`・`formatReminderDigest`・`REMINDER_RANGES` | `buildReminderDigest`（`LicenseEntry`前提のため） |
| `src/core/reminders/scheduleTypes.js` | 使用しない | `registerScheduleFn`・`getScheduleFn`（1.2節） |
| `src/core/eligibility/aggregate.js` | 使用しない | `aggregateEligibility`・`formatChecksSection`（1.3節） |
| `src/core/eligibility/types.js` | 使用しない | `RequirementCheckResult`・`EligibilityResult`（1.3節） |

## 3. データモデル

### 3.1 相続人候補の入力（`src/succession/types.js`）

```js
/**
 * @typedef {"spouse" | "child" | "ascendant" | "sibling"} HeirRelationCategory
 *   FamilyStructureInputのどの配列に属するかを示す大分類。
 *   代襲相続人（孫・ひ孫・甥姪）は元の続柄の配列の中に
 *   HeirCandidateInput.substitutesとしてネストするため、
 *   別の大分類を設けない（4.2節calcLegalHeirsのresolveLineを参照）。
 */

/**
 * @typedef {Object} HeirCandidateInput 相続人になりうる人物1人分の入力
 *   （children / ascendants / siblings の各配列、および代襲相続人
 *   〈substitutes〉として共通で使う型）
 * @property {string} personId 家族構成内で一意なID（本人が任意に付与する
 *   文字列。氏名そのものである必要はない。氏名の入力自体は必須にしない
 *   設計とし、続柄ラベルのみでも運用できるようにする（8章・NFR-S3）
 * @property {string} [label] 表示用ラベル（例: "長男"「配偶者の父」等の
 *   続柄、または氏名。生成書類に表示する場合のみ入力する）
 * @property {boolean} isAlive 相続開始時点で生存しているか
 * @property {boolean} [isSimultaneousDeath] 被相続人との同時死亡の推定
 *   （民法32条の2）に該当するか。該当する場合、isAliveの値によらず
 *   死亡しているものとして扱い、代襲相続の原因になる
 * @property {boolean} [hasRenounced] 相続放棄をしたか（民法939条）。
 *   放棄した者は初めから相続人でなかったものとみなされ、代襲相続の
 *   原因にならない点が、死亡・欠格・廃除と決定的に異なる（4.2節）
 * @property {boolean} [isDisqualifiedOrDisinherited] 相続欠格（民法891条）
 *   または相続人廃除（892条・893条）に該当するか。死亡と同様、
 *   代襲相続の原因になる。該当性の判断自体は本モジュールでは行わず、
 *   発注者が別途確認した結果を入力する前提とする
 * @property {"full" | "half"} [siblingBloodType] relationが兄弟姉妹の
 *   場合のみ使用。父母の双方を同じくするか（全血）、一方のみか（半血。
 *   民法900条4号ただし書）。未入力の場合は全血として扱うが、
 *   calcLegalHeirsは必ずwarningsで確認を促す（4.2節）
 * @property {number} [ascendantDegree] relationが直系尊属の場合のみ
 *   使用。被相続人との親等（父母=1、祖父母=2、曾祖父母=3…）
 * @property {HeirCandidateInput[]} [substitutes] 本人が死亡・同時死亡・
 *   欠格・廃除により相続できない場合の代襲相続人。子の代襲は孫・ひ孫と
 *   再帰的に続けられる（再代襲。887条3項）。兄弟姉妹の代襲は甥姪の
 *   1世代のみとし、そのsubstitutesはcalcLegalHeirsが無視し警告を出す
 *   （889条2項は887条3項を準用しない。4.2節）
 */
```

### 3.2 家族構成の入力（`src/succession/types.js`）

```js
/**
 * @typedef {Object} FamilyStructureInput 法定相続人・法定相続分の
 *   自動計算に使う家族構成の入力（calcLegalHeirsの唯一の引数）
 * @property {string} caseId SuccessionCaseRecord.caseIdと対応する案件ID
 * @property {string} decedentDeathDateIso 被相続人の死亡日（相続開始日。
 *   YYYY-MM-DD）。熟慮期間・相続税申告期限・遺留分侵害額請求の除斥期間
 *   〈10年〉の起点になる（5章）
 * @property {string} [decedentDeathKnownDateIso] 相続人（代表者）が
 *   相続の開始を知った日。省略時はdecedentDeathDateIsoと同一とみなす。
 *   相続放棄の熟慮期間・相続税申告期限・遺留分侵害額請求の消滅時効
 *   〈1年〉は、原則としてこちらを起点とする（民法915条1項・要件定義書
 *   FR-S4.5）
 * @property {boolean} hasSpouse 被相続人に法律上の配偶者がいるか
 *   （内縁関係は法定相続人にならないため対象外。事実婚が存在する場合は
 *   calcLegalHeirsのwarningsで注意喚起する）
 * @property {boolean} [spouseIsAlive] hasSpouseがtrueの場合のみ有効。
 *   配偶者が相続開始時点で生存しているか
 * @property {HeirCandidateInput[]} children 被相続人の子（実子・養子を
 *   区別しない。非嫡出子との相続分差別は平成25年民法改正で撤廃済みの
 *   ため区別フィールドを設けない）
 * @property {HeirCandidateInput[]} ascendants 直系尊属（父母・祖父母等）。
 *   親等の近い者を優先する処理はcalcLegalHeirsが行う（近親者のみが
 *   相続人になるため、遠い親等の者も入力してよい）
 * @property {HeirCandidateInput[]} siblings 被相続人の兄弟姉妹
 */
```

### 3.3 計算結果（`src/succession/types.js`）

```js
/**
 * @typedef {"child-line" | "ascendant" | "sibling-line" | "spouse"} HeirResultRelation
 *   最終的にどの区分の相続人として相続分が確定したかを示すラベル。
 *   代襲相続人であっても、区分は代襲元と同じ扱いとする（例: 孫〈子の
 *   代襲〉も"child-line"）。誰の代襲かはsubstituteForで別途示す
 */

/**
 * @typedef {Object} HeirShareResult 個々の法定相続人1名分の計算結果
 * @property {string} personId 入力のpersonId（代襲相続人の場合は
 *   代襲相続人自身のpersonId。配偶者は固定文字列"spouse"）
 * @property {string} [label]
 * @property {HeirResultRelation} relation
 * @property {string} shareFraction 相続分（既約分数の文字列表現。
 *   例: "1/4"。浮動小数点誤差を避けるため常に分数のまま保持する。
 *   4.1節のFraction型を参照）
 * @property {string} [substituteFor] 代襲相続の場合、誰の代襲かを示す
 *   personId（元の相続人。表示用の参考情報）
 */

/**
 * @typedef {Object} LegalHeirsResult calcLegalHeirsの戻り値
 * @property {"配偶者と子" | "配偶者と直系尊属" | "配偶者と兄弟姉妹" |
 *   "配偶者のみ" | "子のみ" | "直系尊属のみ" | "兄弟姉妹のみ" |
 *   "相続人不存在"} pattern 該当した法定相続のパターン（民法900条各号の
 *   どれに該当するか）
 * @property {HeirShareResult[]} heirs 法定相続人一覧と相続分
 * @property {string[]} warnings 機械計算では判断しきれない事項
 *   （同時死亡の推定・半血兄弟姉妹の判定・養子縁組の有無・内縁関係の
 *   扱い・相続人不存在の場合の専門家相談の推奨等）についての警告文一覧。
 *   必ず1件以上、末尾に「本計算はあくまで入力情報に基づく機械的な試算
 *   であり、戸籍謄本等の一次資料による確認前の最終確定情報として扱わ
 *   ないこと」という定型文を含める（要件定義書FR-S1.9）
 * @property {boolean} allSharesSumToOne 内部検算: 相続分の合計が1に
 *   なっているかの自己チェック結果（実装バグ検出用。falseの場合は
 *   計算ロジックに誤りがある。7章のテストで必ず検証する）
 */
```

### 3.4 財産目録・案件の永続化モデル（`src/succession/types.js`）

```js
/**
 * @typedef {Object} PropertyItem 財産目録1件分
 * @property {string} itemId 案件内で一意なID
 * @property {"不動産" | "預貯金" | "有価証券" | "自動車" | "その他"} category
 * @property {string} description 財産の表示（例: "〇〇銀行△△支店 普通預金"）。
 *   口座番号の全桁等、相続分計算・書類生成に不要な機微情報は含めない
 *   （NFR-S3）
 * @property {number} [estimatedValueYen] 概算評価額（円。任意。不明な
 *   場合は省略可。正式な相続税評価額の算定は本モジュールの対象外
 *   〈要件定義書4.6節〉であり、あくまで参考値の扱いとする）
 * @property {string} [assignedHeirPersonId] 遺産分割協議で合意済みの
 *   取得者（HeirShareResult.personIdを参照。配偶者は"spouse"）。
 *   未合意の場合は省略する
 */

/**
 * @typedef {Object} SuccessionCaseRecord 相続案件1件分の永続化レコード
 *   （data/succession-cases.json。ClientRecord・CaseRecordと対になる設計）
 * @property {string} caseId 一意なID
 * @property {string} [caseLabel] 案件の表示ラベル（例: "〇〇家 相続手続き"）
 * @property {string} decedentDeathDateIso 被相続人の死亡日
 * @property {string} [decedentDeathKnownDateIso] 相続人が相続開始を
 *   知った日（3.2節参照）
 * @property {FamilyStructureInput} familyStructure 法定相続人算出に
 *   使った家族構成の入力（再計算・変更履歴確認用に保持する）
 * @property {LegalHeirsResult} [lastCalculatedResult] 直近の計算結果
 *   （キャッシュ。家族構成の変更のたびにcalcLegalHeirsを再実行し上書きする）
 * @property {PropertyItem[]} [properties] 財産目録
 * @property {"遺産分割協議書作成中" | "自筆証書遺言作成支援中" | "完了" |
 *   "保留"} status 案件の進捗ステータス
 * @property {boolean} hasDisputeAmongHeirs 相続人間に争いの兆候があるか
 *   （自動判定はしない。発注者が人手で確認し記録するフラグ。trueの場合、
 *   本モジュールでの協議書作成支援を続行してよいか都度人手確認する。
 *   要件定義書FR-S2.5・NFR-S1）
 * @property {string[]} [notes] 自由記述メモ
 */
```

`ApplicantProfile`（建設業許可）・`ClientRecord`/`LicenseEntry`（コア）
・`CaseRecord`（下請けポータル）とは意図的に型を共有しない。相続人・
被相続人の個人情報を扱う本モジュール専用の型として独立させることで、
他モジュールの型に相続関連のフィールドが紛れ込むことを防ぐ
（NFR-S2・NFR-S3を型レベルで担保する）。

## 4. モジュール詳細設計

### 4.1 `heirs/fraction.js`（新規）

相続分を浮動小数点で扱うと丸め誤差が生じる（例: 1/3 + 1/3 + 1/3 が
1にならない）ため、内部計算はすべて`BigInt`による既約分数で行う。

```js
// src/succession/heirs/fraction.js

/**
 * @typedef {Object} Fraction
 * @property {bigint} n 分子
 * @property {bigint} d 分母（常に正）
 */

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

/** @param {number|bigint} n @param {number|bigint} [d] @returns {Fraction} */
export function frac(n, d = 1) {
  const bn = BigInt(n), bd = BigInt(d);
  if (bd === 0n) throw new Error("分母が0の分数は作成できません");
  const sign = bd < 0n ? -1n : 1n;
  const g = gcd(bn, bd);
  return { n: (sign * bn) / g, d: (sign * bd) / g };
}

/** @param {Fraction} a @param {Fraction} b @returns {Fraction} */
export function mulFrac(a, b) {
  return frac(a.n * b.n, a.d * b.d);
}

/** @param {Fraction} a @param {Fraction} b @returns {Fraction} */
export function addFrac(a, b) {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

/** @param {Fraction[]} fracs @returns {Fraction} */
export function sumFrac(fracs) {
  return fracs.reduce(addFrac, frac(0, 1));
}

/** @param {Fraction} f @returns {string} 例: "1/4"（分母1の場合は整数表記） */
export function formatFrac(f) {
  return f.d === 1n ? `${f.n}` : `${f.n}/${f.d}`;
}
```

### 4.2 `heirs/calcLegalHeirs.js`（新規・本設計の中核）

法定相続人・法定相続分の計算を、次の3段階で行う。

1. **系統の解決（`resolveLine`）**: children・siblingsの各候補1人ずつ
   について、本人が有効な相続人かどうか、無効なら代襲相続人をたどって
   有効な相続人を探す（再帰）。系統内に有効な相続人が1人もいなければ
   空配列を返す。この「空配列を返す」という単純な仕組みだけで、
   相続放棄（代襲なし）・代襲相続人も全員無効（系統ごと消滅）の
   両方を、上位の配分ロジック側で自然に扱える設計にしている
2. **順位の判定**: 子（代襲含む）が1人でもいれば第1順位で確定。
   いなければ直系尊属（親等最小の生存者）、それもいなければ兄弟姉妹
   （代襲含む）の順で判定する（民法887条〜890条の順位構造）
3. **配偶者との組み合わせ**: 配偶者の生存有無と、上記で確定した血族側の
   区分（子／直系尊属／兄弟姉妹／なし）の組み合わせで、最終的な
   相続分（民法900条1〜4号）を確定する

```js
// src/succession/heirs/calcLegalHeirs.js
import { frac, mulFrac, sumFrac, formatFrac } from "./fraction.js";

const GENERAL_DISCLAIMER =
  "この計算結果は入力された家族構成情報に基づく機械的な試算です。" +
  "戸籍謄本等の収集・確認により、養子縁組・認知・重複する代襲関係等が" +
  "判明した場合、結果が変わる可能性があります。最終的な相続人の確定には、" +
  "必ず戸籍謄本等一式による裏付け確認を行ってください。";

/**
 * ある1人の相続人候補（子・兄弟姉妹の配列の要素）を、本人＋代襲相続人まで
 * 再帰的にたどり、「その人の系統に割り当てられる全体1のうちの取り分」を
 * 返す。系統内に有効な相続人が1人もいなければ空配列を返す（＝この系統は
 * 除外＝分母から外れる、という効果を上位の distributeEqually 側で
 * 自然に実現できる）。
 *
 * @param {import('../types.js').HeirCandidateInput} candidate
 * @param {{ allowReRepresentation: boolean }} opts
 *   allowReRepresentation: 子の代襲は孫→ひ孫と再帰的に続く（再代襲。
 *   887条3項）。兄弟姉妹の代襲は甥姪の1階層限り（889条2項は887条3項を
 *   準用しない）のため、兄弟姉妹側の呼び出しではfalseを渡す
 * @returns {{ personId: string, label?: string, share: import('./fraction.js').Fraction }[]}
 */
function resolveLine(candidate, opts) {
  if (candidate.hasRenounced) {
    // 相続放棄をした者は「初めから相続人でなかった」ものとみなされ
    // （民法939条）、代襲相続は発生しない（887条2項の反対解釈。
    // 要件定義書6章で一次資料要確認）。
    return [];
  }
  const isEffectivelyDead =
    !candidate.isAlive || !!candidate.isSimultaneousDeath || !!candidate.isDisqualifiedOrDisinherited;
  if (!isEffectivelyDead) {
    return [{ personId: candidate.personId, label: candidate.label, share: frac(1, 1) }];
  }
  const substitutes = candidate.substitutes ?? [];
  if (substitutes.length === 0) return [];

  const resolvedSubLines = substitutes
    .map((s) => (opts.allowReRepresentation ? resolveLine(s, opts) : resolveTerminalSubstitute(s)))
    .filter((r) => r.length > 0);
  if (resolvedSubLines.length === 0) return []; // 代襲相続人も全員無効。この系統は分母から外れる

  const perLine = frac(1, resolvedSubLines.length);
  return resolvedSubLines.flatMap((line) => line.map((h) => ({ ...h, share: mulFrac(h.share, perLine) })));
}

/**
 * 兄弟姉妹の代襲相続人（甥・姪）は、本人がさらに死亡していてもその子への
 * 再代襲は生じない（1階層限り）。
 * @param {import('../types.js').HeirCandidateInput} nephewOrNiece
 */
function resolveTerminalSubstitute(nephewOrNiece) {
  if (nephewOrNiece.hasRenounced) return [];
  if (!nephewOrNiece.isAlive || nephewOrNiece.isSimultaneousDeath) return [];
  return [{ personId: nephewOrNiece.personId, label: nephewOrNiece.label, share: frac(1, 1) }];
}

/** 複数の系統に、総取り分totalShareを均等配分する（子・直系尊属用） */
function distributeEqually(lines, totalShare) {
  if (lines.length === 0) return [];
  const perLine = mulFrac(totalShare, frac(1, lines.length));
  return lines.flatMap((line) => line.map((h) => ({ ...h, share: mulFrac(h.share, perLine) })));
}

/**
 * 兄弟姉妹用: 全血=weight2、半血=weight1の比率で総取り分を配分する
 * （民法900条4号ただし書）。
 * @param {{ candidate: import('../types.js').HeirCandidateInput, resolved: ReturnType<typeof resolveLine> }[]} weightedLines
 */
function distributeSiblingLines(weightedLines, totalShare) {
  const validLines = weightedLines.filter((w) => w.resolved.length > 0);
  if (validLines.length === 0) return [];
  const totalWeight = validLines.reduce(
    (sum, w) => sum + (w.candidate.siblingBloodType === "half" ? 1 : 2),
    0
  );
  return validLines.flatMap((w) => {
    const weight = w.candidate.siblingBloodType === "half" ? 1 : 2;
    const lineShare = mulFrac(totalShare, frac(weight, totalWeight));
    return w.resolved.map((h) => ({ ...h, share: mulFrac(h.share, lineShare) }));
  });
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @returns {import('../types.js').LegalHeirsResult}
 */
export function calcLegalHeirs(family) {
  const warnings = [];
  const spouseAlive = !!family.hasSpouse && !!family.spouseIsAlive;

  // 第1順位: 子（代襲は孫→ひ孫と再帰的、887条2・3項）
  const childLines = (family.children ?? []).map((c) => resolveLine(c, { allowReRepresentation: true }));
  const validChildLines = childLines.filter((l) => l.length > 0);

  let bloodHeirs = [];
  let bloodRank = "なし";

  if (validChildLines.length > 0) {
    bloodRank = "子";
    bloodHeirs = distributeEqually(validChildLines, frac(1, 1));
  } else {
    // 第2順位: 直系尊属。親等が最も近い、生存かつ未放棄の者のみが対象
    // （直系尊属に代襲相続の概念はなく、単に近親者が優先するだけ）。
    const aliveAscendants = (family.ascendants ?? []).filter(
      (a) => a.isAlive && !a.hasRenounced && !a.isSimultaneousDeath
    );
    if (aliveAscendants.length > 0) {
      const minDegree = Math.min(...aliveAscendants.map((a) => a.ascendantDegree ?? 1));
      const nearest = aliveAscendants.filter((a) => (a.ascendantDegree ?? 1) === minDegree);
      bloodRank = "直系尊属";
      bloodHeirs = distributeEqually(
        nearest.map((a) => [{ personId: a.personId, label: a.label, share: frac(1, 1) }]),
        frac(1, 1)
      );
    } else {
      // 第3順位: 兄弟姉妹（代襲は甥姪の1代限り。889条2項）
      const siblingLines = (family.siblings ?? []).map((s) => ({
        candidate: s,
        resolved: resolveLine(s, { allowReRepresentation: false }),
      }));
      if (siblingLines.some((w) => w.resolved.length > 0)) {
        bloodRank = "兄弟姉妹";
        bloodHeirs = distributeSiblingLines(siblingLines, frac(1, 1));
        if (siblingLines.some((w) => w.resolved.length > 0 && !w.candidate.siblingBloodType)) {
          warnings.push(
            "兄弟姉妹の一部で全血・半血の別（siblingBloodType）が未入力です。" +
              "半血の場合は相続分が半分になるため、戸籍で必ず確認してください。"
          );
        }
      }
    }
  }

  // 配偶者との組み合わせで最終的な相続分を確定する（民法900条1〜3号）
  const heirsInternal = []; // { personId, label, relation, share: Fraction, substituteFor? }
  let pattern;

  if (spouseAlive && bloodHeirs.length > 0) {
    const spouseShare = bloodRank === "子" ? frac(1, 2) : bloodRank === "直系尊属" ? frac(2, 3) : frac(3, 4);
    const bloodTotalShare = bloodRank === "子" ? frac(1, 2) : bloodRank === "直系尊属" ? frac(1, 3) : frac(1, 4);
    heirsInternal.push({ personId: "spouse", relation: "spouse", share: spouseShare });
    for (const h of bloodHeirs) {
      heirsInternal.push({
        personId: h.personId,
        label: h.label,
        relation: bloodRank === "子" ? "child-line" : bloodRank === "直系尊属" ? "ascendant" : "sibling-line",
        share: mulFrac(h.share, bloodTotalShare),
      });
    }
    pattern = `配偶者と${bloodRank}`;
  } else if (spouseAlive) {
    heirsInternal.push({ personId: "spouse", relation: "spouse", share: frac(1, 1) });
    pattern = "配偶者のみ";
  } else if (bloodHeirs.length > 0) {
    for (const h of bloodHeirs) {
      heirsInternal.push({
        personId: h.personId,
        label: h.label,
        relation: bloodRank === "子" ? "child-line" : bloodRank === "直系尊属" ? "ascendant" : "sibling-line",
        share: h.share,
      });
    }
    pattern = `${bloodRank}のみ`;
  } else {
    pattern = "相続人不存在";
    warnings.push(
      "法定相続人が1人も見つかりませんでした。相続財産清算人の選任等、" +
        "家庭裁判所での手続きが必要になる可能性が高いため、弁護士への相談を" +
        "強く推奨します（本モジュールの対応範囲外です）。"
    );
  }

  // 【実装時の注意】family.hasSpouseがtrueなのにspouseIsAliveが未入力
  // （undefined）のケースは、入力漏れとしてvalidateFamilyStructure等の
  // 事前バリデーションで弾く設計を推奨する（本関数は入力が妥当である
  // ことを前提にしている）。

  warnings.push(GENERAL_DISCLAIMER);

  const total = sumFrac(heirsInternal.map((h) => h.share));
  return {
    pattern,
    heirs: heirsInternal.map((h) => ({
      personId: h.personId,
      label: h.label,
      relation: h.relation,
      shareFraction: formatFrac(h.share),
    })),
    warnings,
    allSharesSumToOne: heirsInternal.length === 0 ? pattern === "相続人不存在" : total.n === total.d,
  };
}
```

**設計上のポイント（`resolveLine`が代襲相続を統一的に扱える理由）**:
「本人が有効なら`[{share: 1}]`、無効なら代襲相続人を再帰的にたどり、
系統内に誰もいなければ`[]`」という単純な再帰関数1つで、(a) 相続放棄
（代襲なし・系統ごと消滅）、(b) 死亡・欠格・廃除＋有効な代襲相続人あり
（per stirpes配分）、(c) 死亡だが代襲相続人も全員無効（系統ごと消滅）、
(d) 再代襲（子の代襲人＝孫もさらに死亡している場合、ひ孫へ続く）の
4パターンすべてを、上位の`distributeEqually`/`distributeSiblingLines`
側で特別扱いすることなく処理できる。これは`docs/DESIGN_kobutsu-core.md`
が古物商許可の`kekkaku.js`で示した「フラグ配列を回して理由文を組み立てる」
パターンとは異なる、**再帰による木構造の解決**という新しいコード
パターンであり、要件定義書0章で述べた「要件判定エンジンの新しい
使い道」を最も象徴する部分である。

### 4.3 `documents/`（財産目録・遺産分割協議書・自筆証書遺言）

いずれもコアの`resolve<様式名>Rows` / `build<様式名>Document` /
`write<様式名>Docx`の3関数パターンを踏襲する（`docs/DESIGN_kobutsu-core.md`
5.10節と同型）。`isanBunkatsuKyogisho.js`のみ例示する。

```js
// src/succession/documents/isanBunkatsuKyogisho.js
import { Document, Paragraph, TextRun } from "docx";
import {
  A4_PAGE_PROPERTIES,
  buildTitleHeading,
  buildDisclaimerParagraph,
  buildLabeledTable,
  orNotEntered,
  writeDocxFile,
} from "../../core/documents/common.js";

const SUCCESSION_DISCLAIMER_EXTRA =
  "※ 本書面は相続人全員の合意内容を整理したサマリーです。実際の提出・" +
  "登記手続き等には、相続人全員の実印による押印・印鑑証明書の添付など、" +
  "別途必要な体裁を個別に確認してください。";

/**
 * @param {import('../types.js').LegalHeirsResult} heirsResult
 * @param {import('../types.js').PropertyItem[]} properties
 * @returns {[string, string][]}
 */
export function resolveIsanBunkatsuKyogishoRows(heirsResult, properties) {
  const rows = heirsResult.heirs.map((h) => [
    `法定相続人: ${orNotEntered(h.label ?? h.personId)}`,
    `法定相続分: ${h.shareFraction}`,
  ]);
  for (const p of properties) {
    rows.push([
      `財産: ${p.category} ${orNotEntered(p.description)}`,
      `取得者: ${orNotEntered(p.assignedHeirPersonId)}`,
    ]);
  }
  return rows;
}

export function buildIsanBunkatsuKyogishoDocument(heirsResult, properties, caseRecord) {
  const children = [
    buildTitleHeading("遺産分割協議書 — 合意内容サマリー"),
    buildDisclaimerParagraph(),
    new Paragraph({ children: [new TextRun(SUCCESSION_DISCLAIMER_EXTRA)] }),
  ];
  if (caseRecord.hasDisputeAmongHeirs) {
    // 要件定義書FR-S2.5: 争いの兆候フラグが立っている案件では、
    // 協議書サマリーの先頭に職域外警告を強調して差し込む。
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              "【重要】相続人間に争いの兆候が記録されています。争いがある場合の" +
              "遺産分割協議書の作成・交渉は行政書士の業務範囲外であり、弁護士への" +
              "相談が必要です。本書面の作成・使用前に必ず確認してください。",
            bold: true,
          }),
        ],
      })
    );
  }
  children.push(buildLabeledTable(resolveIsanBunkatsuKyogishoRows(heirsResult, properties)));
  return new Document({ sections: [{ properties: A4_PAGE_PROPERTIES, children }] });
}

export async function writeIsanBunkatsuKyogishoDocx(heirsResult, properties, caseRecord, outPath) {
  await writeDocxFile(buildIsanBunkatsuKyogishoDocument(heirsResult, properties, caseRecord), outPath);
}
```

`zaisanMokuroku.js`（財産目録）は`properties`のみを表にする単純な構成、
`jihitsushoshoYuigon.js`（自筆証書遺言 文案）は、本文（自書必須）と
財産目録部分（自書不要）を別セクションに分け、FR-S3.2の強い注記
（代筆・PC作成した本文は無効になる旨）を太字で先頭に配置する構成とする。
遺留分の目安チェック（FR-S3.4）は、`calcLegalHeirs`の結果から各相続人の
法定相続分を求め、その1/2（直系尊属のみの場合は1/3）を下回る割当てが
`properties`の`assignedHeirPersonId`集計から見つかった場合に、
`warnings`と同様の形で文案の末尾に注記として出力する。

### 4.4 `caseStore.js`

`docs/DESIGN_uketsuke-portal.md` 4.1節の`caseStore.js`と同じ設計
パターン（単一JSONファイル・`fs.readFile`/`writeFile`・ディレクトリ
自動作成）を踏襲する。

```js
export const DEFAULT_SUCCESSION_CASES_PATH = "data/succession-cases.json";
// loadSuccessionCases / saveSuccessionCases / upsertSuccessionCase / removeSuccessionCase
// （既存caseStore.js・clientStore.jsと同じ実装パターン）
```

`upsertSuccessionCase`は、`familyStructure`が更新されるたびに
`calcLegalHeirs`を呼び直し、`lastCalculatedResult`を上書きする
（呼び出し側が計算結果の再計算を忘れないようにするため、更新関数の
内部で自動的に再計算する設計とする）。

## 5. リマインド設計

相続手続きに関連する期限を、コアの`ScheduleFn`契約（`LicenseEntry`
前提）には乗せず、`docs/DESIGN_uketsuke-portal.md` 4.3節の
`buildCaseDeadlineAlerts`と同じパターンで、`SuccessionCaseRecord`から
直接、コアの`ReminderAlert`と同じ形のオブジェクトを組み立てる
（1.2節の設計原則を実装する部分）。

```js
// src/succession/reminders/souzokuDeadlines.js
/**
 * 【重要】ここで計算するのはあくまで期限の「見える化」である。各期限に
 * 対応する実際の手続き（相続放棄の申述・相続税申告・遺留分侵害額請求の
 * 意思表示）の代理・作成は、行政書士の業務範囲外のものを含む（要件定義書
 * 1.3節）。各関数が返すlabelには、必ず担当すべき専門家を明記する。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {string} iso @param {number} months 暦月単位の加算（月末クランプ） */
function addMonthsClamped(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const targetYear = y + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12; // 0-11
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay)).toISOString().slice(0, 10);
}

/** @param {string} iso @param {number} years */
function addYearsClamped(iso, years) {
  return addMonthsClamped(iso, years * 12);
}

/** @param {string} iso @param {number} days */
function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * 相続放棄の熟慮期間の期限（民法915条1項: 自己のために相続の開始が
 * あったことを知った時から3ヶ月）。
 * @param {string} knownDateIso 相続の開始を知った日
 */
export function calcSouzokuHoukiDeadline(knownDateIso) {
  return {
    type: "souzoku-houki",
    label: "相続放棄の申述期限（3ヶ月）※申述書の作成は弁護士・司法書士の職域",
    dueDateIso: addMonthsClamped(knownDateIso, 3),
  };
}

/**
 * 相続税の申告・納付期限（相続税法27条・33条: 相続の開始があったことを
 * 知った日の翌日から10ヶ月）。
 * @param {string} knownDateIso
 */
export function calcSouzokuzeiShinkokuDeadline(knownDateIso) {
  const startFromNextDay = addDaysIso(knownDateIso, 1);
  return {
    type: "souzokuzei-shinkoku",
    label: "相続税の申告・納付期限（10ヶ月）※申告書の作成は税理士の独占業務",
    dueDateIso: addMonthsClamped(startFromNextDay, 10),
  };
}

/**
 * 遺留分侵害額請求の期間制限（民法1048条）。「知った時から1年」の消滅
 * 時効と、「相続開始の時から10年」の除斥期間の2つがあり、早い方が優先
 * する。両方をリマインドとして提示する。
 * @param {string} deathDateIso 相続開始日（死亡日）
 * @param {string} [knownDateIso] 遺留分の侵害を知った日（省略時はdeathDateIsoと同一とみなす）
 */
export function calcIryuubunSeikyuDeadlines(deathDateIso, knownDateIso) {
  const from = knownDateIso ?? deathDateIso;
  return [
    {
      type: "iryuubun-1nen",
      label: "遺留分侵害額請求の期限（知った時から1年・消滅時効）※請求の代理は弁護士の職域",
      dueDateIso: addYearsClamped(from, 1),
    },
    {
      type: "iryuubun-10nen",
      label: "遺留分侵害額請求の期限（相続開始から10年・除斥期間）※請求の代理は弁護士の職域",
      dueDateIso: addYearsClamped(deathDateIso, 10),
    },
  ];
}

/**
 * SuccessionCaseRecord一覧から、コアのReminderAlertと同じ形のリマインド
 * 項目を生成する。docs/DESIGN_uketsuke-portal.md 4.3節の
 * buildCaseDeadlineAlertsと同じ設計パターン。
 * @param {import('../types.js').SuccessionCaseRecord[]} cases
 * @param {string} [todayIso]
 * @returns {import('../../core/reminders/digest.js').ReminderAlert[]}
 */
export function buildSuccessionDeadlineAlerts(cases, todayIso) {
  const alerts = [];
  for (const c of cases) {
    if (c.status === "完了") continue;
    const known = c.decedentDeathKnownDateIso ?? c.decedentDeathDateIso;
    const items = [
      calcSouzokuHoukiDeadline(known),
      calcSouzokuzeiShinkokuDeadline(known),
      ...calcIryuubunSeikyuDeadlines(c.decedentDeathDateIso, known),
    ];
    for (const item of items) {
      alerts.push(makeSuccessionAlert(c, item, todayIso));
    }
  }
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

function makeSuccessionAlert(caseRecord, item, todayIso) {
  // daysUntil計算自体はconstruction/reminders/renewalSchedule.jsのdaysUntilと
  // 同じ実装。docs/DESIGN_uketsuke-portal.md 4.3節と同じ理由（tech debt）で
  // 直接importして流用する（9章参照）。
  const days = daysUntil(item.dueDateIso, todayIso);
  return {
    clientName: caseRecord.caseLabel ?? `案件 ${caseRecord.caseId}`,
    type: item.type,
    label: item.label,
    dueDateIso: item.dueDateIso,
    daysUntil: days,
    isOverdue: days < 0,
  };
}
```

呼び出し側（CLIスクリプト）は、`buildSuccessionDeadlineAlerts`の戻り値を
コアの`bucketizeAlerts`・`formatReminderDigest`にそのまま渡すことで、
既存のリマインド表示ロジックを再利用できる。**許可のリマインド一覧
（`buildReminderDigest`）・下請け案件の納期リマインドとは別の一覧
として扱い、3つを強制的に1つに統合はしない**（`docs/DESIGN_uketsuke-portal.md`
5章と同じ判断。必要であれば呼び出し側スクリプトで単純に配列結合して
表示することは可能）。

## 6. 実装ステップ

| ステップ | 内容 | 完了条件 |
|---|---|---|
| Step 1 | `types.js`・`heirs/fraction.js` | 単体テストで既約分数の加算・乗算が正しいことを確認 |
| Step 2 | `heirs/calcLegalHeirs.js` | 代表的な家族構成パターン（要件定義書5章の受け入れ基準3）すべてでテストが通ること。**本モジュールの中核であり、他ステップより厚くレビューする** |
| Step 3 | `caseStore.js`（永続化） | 複数案件の登録・更新時にlastCalculatedResultが自動再計算されることを確認 |
| Step 4 | `documents/`（財産目録→遺産分割協議書→自筆証書遺言の順） | ダミーデータからdocxが生成でき、免責注記・職域外警告が含まれること |
| Step 5 | `reminders/souzokuDeadlines.js` | 3種類の期限（相続放棄・相続税申告・遺留分侵害額請求）が正しく計算されること |
| Step 6 | CLIスクリプト（`scripts/succession-case-add.js`等）の追加 | 一連の操作（案件登録→計算→書類生成→リマインド確認）がCLIから通しで実行できること |

各ステップは独立したPRとして分割することを推奨する（既存の
`DEVELOPMENT_GUIDE.md` 3.2節を踏襲）。

## 7. テスト方針

`docs/DESIGN_kobutsu-core.md` 7章（公開関数の入出力を検証する、法定
要件の分岐網羅を重視する、`node --test`を使う）を継承する。

新規追加分のテスト観点:

- `fraction.js`: 約分の正確性（例: `frac(2,4)`が`{n:1,d:2}`になる）、
  加算・乗算の組み合わせで既約分数が保たれること
- `calcLegalHeirs`（最重要。網羅的にテストする）:
  - 配偶者と子（子1人／複数人）
  - 配偶者と直系尊属（父母双方生存／片方のみ生存／祖父母のみ生存）
  - 配偶者と兄弟姉妹（全血のみ／半血混在）
  - 子のみ（配偶者なし）、直系尊属のみ、兄弟姉妹のみ
  - 代襲相続: 子が死亡し孫が代襲、孫も死亡しひ孫が再代襲（2段階）
  - 兄弟姉妹の代襲: 兄弟姉妹が死亡し甥姪が代襲、甥姪がさらに死亡している
    場合に再代襲が発生しないこと（該当系統の取り分が消滅すること）
  - 相続放棄: 放棄した子に代襲が発生しないこと（子がいなくなり直系尊属に
    順位が移る場合を含む）
  - 相続欠格・廃除: 死亡と同様に代襲相続が発生すること（放棄との違いの確認）
  - 相続人不存在パターンで`pattern: "相続人不存在"`・専門家相談の警告が
    出ること
  - どのパターンでも`allSharesSumToOne`が`true`になること（回帰確認の要）
  - `siblingBloodType`未入力時に警告が出ること
- `documents/`: ダミーデータからdocxが生成でき、免責注記が含まれること。
  `hasDisputeAmongHeirs: true`の案件で職域外警告の段落が含まれること
  （既存の`youshiki1.test.js`相当のテストパターン）
- `souzokuDeadlines.js`: `calcSouzokuHoukiDeadline`・
  `calcSouzokuzeiShinkokuDeadline`・`calcIryuubunSeikyuDeadlines`の
  月またぎ・年またぎ・うるう年を含む境界値テスト。「知った日」を
  死亡日と別に指定した場合の起算点の違いが反映されること
- `caseStore.js`: 案件更新時に`lastCalculatedResult`が自動再計算される
  こと、複数案件が混在しないこと

## 8. 非機能設計

`docs/DESIGN_kobutsu-core.md` 8章（NFR-1〜7に対応する設計上の配慮）を
継承する。追加の配慮事項:

- **型レベルでのマイナンバー排除（NFR-S2）**: `HeirCandidateInput`・
  `SuccessionCaseRecord`・`PropertyItem`のいずれにも、マイナンバー
  （個人番号）を保持するフィールドを設けない。コードレビューでは
  「このフィールドは戸籍謄本・住民票の記載事項の範囲に収まっているか」
  を基準にする
- **氏名入力の任意化（NFR-S3）**: `HeirCandidateInput.label`はあくまで
  任意項目とし、続柄ラベル（例: "長男"）のみでも計算・書類生成が完結
  する設計とする。氏名を入力するかどうかは発注者の運用判断に委ねる
- **`warnings`配列を空にできない設計（NFR-S1の実装担保）**:
  `calcLegalHeirs`は、どのパターンでも必ず`GENERAL_DISCLAIMER`を
  `warnings`の末尾に含める（4.2節のコードで担保）。テスト（7章）で
  `warnings.length >= 1`を全パターン共通のアサーションとして入れることを
  推奨する
- **`allSharesSumToOne`を実装のセーフティネットとして使う**:
  この自己検算は本番のロジックエラーを検出するためのものであり、
  呼び出し側（CLI・docx生成）は`allSharesSumToOne === false`の場合に
  処理を中断し、エラーとして表示することを推奨する（誤った相続分を
  そのまま書類化してしまう事故を防ぐ）
- 争いの有無・遺留分該当性等、法的評価を要する事項を自動化しないという
  設計判断（1.4節）を、`.github/pull_request_template.md`のセルフ
  レビューチェックリストに「新しい自動判定ロジックを追加していないか」
  という項目として追加することを推奨する

## 9. 今後の拡張ポイント（本フェーズ後の検討事項）

- **数次相続への対応**: 遺産分割前に相続人自身が死亡し、その相続人の
  相続人がさらに承継するケース（代襲相続とは法的性質が異なる）。
  `calcLegalHeirs`とは別の計算関数として実装する必要があり、本フェーズの
  スコープには含めない（要件定義書4.6節）
- **法定相続情報一覧図（法務局）出力への対応**: **2026年9月実装済み**。
  `documents/houteiSouzokuJohoIchiranzu.js`が`calcLegalHeirs`の結果と
  `FamilyStructureInput`（被相続人・相続人の氏名/生年月日等を新規追加）から
  記載内容サマリーをdocx生成する。法務局公表の正式な家系図形式のレイアウト
  には対応せず、内容確認用サマリーに留める（他の様式生成モジュールと同じ
  「サマリーのみ・正式様式ではない」方針を踏襲）。続柄は`relation`の
  4大分類（配偶者/子/直系尊属/兄弟姉妹）からの近似表示であり、代襲相続人の
  正確な続柄（孫・甥姪等）までは自動判定しない旨を出力に明記する
- **相続税の基礎控除額の目安表示**: 基礎控除額（3,000万円＋600万円×
  法定相続人数）の参考値を`calcLegalHeirs`の結果件数から算出して
  表示する連携（ただし相続税額そのものの計算は税理士の職域のため対象外
  であることを明記し続ける）
- **`addMonthsClamped`の共通化**: 【2026年9月訂正】`daysUntil`については、
  M11のコア抽出（`docs/DESIGN_kobutsu-core.md` 5.3節）で既に
  `src/core/reminders/dateUtils.js`へ切り出し済みだったため、本モジュールを
  含む全モジュールが最初からそこを直接importしており、想定していた
  技術的負債は実際には発生しなかった（`docs/DESIGN_uketsuke-portal.md`側の
  記載も訂正済み）。一方`addMonthsClamped`（月単位の丸め計算）は、
  `src/core/reminders/expirySchedule.js`・`src/licenses/construction/reminders/renewalSchedule.js`
  （いずれも`Date`型ベース）・本モジュールの`souzokuDeadlines.js`
  （ISO文字列ベース）の3箇所で、シグネチャの異なる実装が独立して存在して
  おり、こちらは引き続き重複が残っている。共通化する場合はDate型か
  ISO文字列型かのインターフェース統一が必要になる点に注意（次フェーズで
  検討する）
- **Web一覧表示への対応**（`src/web/`の拡張。他モジュール同様、本フェーズは対象外）
- **遺言執行者の指定支援**: **2026年9月実装済み**。`documents/jihitsushoshoYuigon.js`の
  `buildJihitsushoshoYuigonDocument`が`executorName`オプションを受け取り、
  指定時のみ遺言執行者の指定条項（民法1006条1項）を本文に追加する
  （未指定時は従来どおり条項自体を出力しない）
- **二次相続シミュレーション**: 配偶者が相続後に死亡した場合の次の相続
  （二次相続）を見据えた分割案の比較支援（本フェーズは単一の相続開始
  イベントのみを対象とする）
