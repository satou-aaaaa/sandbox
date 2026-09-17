/**
 * 相続関連（遺言書・遺産分割協議書）支援モジュールのデータ型定義（JSDoc）。
 *
 * 【設計原則】本モジュールは許可種別アドオン（`src/licenses/<種別>/`）ではなく、
 * 「許可の可否」ではなく「相続財産の分配」を計算する独立した業務ドメイン
 * （`docs/DESIGN_souzoku-support.md` 1.1節）。`ApplicantProfile`・
 * `ClientRecord`/`LicenseEntry`・`CaseRecord`（下請けポータル）とは
 * 意図的に型を共有しない。
 *
 * 【職域境界・機微情報の担保】
 * - 相続人間の争いの有無（`SuccessionCaseRecord.hasDisputeAmongHeirs`）・
 *   遺留分侵害の該当性・同時死亡の推定・欠格事由該当性等、法的評価を
 *   要する事項は自動判定しない（NFR-S1）
 * - マイナンバー（個人番号）を保持するフィールドは一切設けない（NFR-S2）
 * - `HeirCandidateInput.label`は任意項目とし、氏名を入力しなくても
 *   計算・書類生成が完結する設計とする（NFR-S3）
 */

/**
 * @typedef {"child-line" | "ascendant" | "sibling-line" | "spouse"} HeirResultRelation
 *   最終的にどの区分の相続人として相続分が確定したかを示すラベル。
 *   代襲相続人であっても、区分は代襲元と同じ扱いとする（例: 孫〈子の
 *   代襲〉も"child-line"）
 */

/**
 * @typedef {Object} HeirCandidateInput 相続人になりうる人物1人分の入力
 *   （children / ascendants / siblings の各配列、および代襲相続人
 *   〈substitutes〉として共通で使う型）
 * @property {string} personId 家族構成内で一意なID（本人が任意に付与する
 *   文字列。氏名そのものである必要はない。氏名の入力自体は必須にしない
 *   設計とし、続柄ラベルのみでも運用できるようにする（NFR-S3）
 * @property {string} [label] 表示用ラベル（例: "長男"「配偶者の父」等の
 *   続柄、または氏名。生成書類に表示する場合のみ入力する）
 * @property {boolean} isAlive 相続開始時点で生存しているか
 * @property {boolean} [isSimultaneousDeath] 被相続人との同時死亡の推定
 *   （民法32条の2）に該当するか。該当する場合、isAliveの値によらず
 *   死亡しているものとして扱い、代襲相続の原因になる
 * @property {boolean} [hasRenounced] 相続放棄をしたか（民法939条）。
 *   放棄した者は初めから相続人でなかったものとみなされ、代襲相続の
 *   原因にならない点が、死亡・欠格・廃除と決定的に異なる
 * @property {boolean} [isDisqualifiedOrDisinherited] 相続欠格（民法891条）
 *   または相続人廃除（892条・893条）に該当するか。死亡と同様、
 *   代襲相続の原因になる。該当性の判断自体は本モジュールでは行わず、
 *   発注者が別途確認した結果を入力する前提とする
 * @property {boolean} [isAdopted] 被相続人の養子か（childrenの要素の場合の
 *   み使用。相続分の計算〈calcLegalHeirs〉では実子・養子を区別しないため
 *   参照しないが、相続税の基礎控除額の計算〈calcSouzokuzeiKisokoujogaku〉
 *   では養子の数に上限がある〈相続税法15条2項〉ため区別が必要になる。
 *   特別養子縁組による養子・被相続人の配偶者の連れ子で養子となった者等
 *   （同条3項により実子とみなされる者）は、この上限の対象外のため
 *   isAdoptedをtrueにしないこと（未入力=実子として扱う）
 * @property {"full" | "half"} [siblingBloodType] relationが兄弟姉妹の
 *   場合のみ使用。父母の双方を同じくするか（全血）、一方のみか（半血。
 *   民法900条4号ただし書）。未入力の場合は全血として扱うが、
 *   calcLegalHeirsは必ずwarningsで確認を促す
 * @property {number} [ascendantDegree] relationが直系尊属の場合のみ
 *   使用。被相続人との親等（父母=1、祖父母=2、曾祖父母=3…）
 * @property {HeirCandidateInput[]} [substitutes] 本人が死亡・同時死亡・
 *   欠格・廃除により相続できない場合の代襲相続人。子の代襲は孫・ひ孫と
 *   再帰的に続けられる（再代襲。887条3項）。兄弟姉妹の代襲は甥姪の
 *   1世代のみとし、そのsubstitutesはcalcLegalHeirsが無視する
 *   （889条2項は887条3項を準用しない）
 * @property {string} [birthDate] 生年月日（YYYY-MM-DD、任意）。相続分の
 *   計算では使わないが、法定相続情報一覧図（不動産登記規則247条1項2号）は
 *   相続人の生年月日の記載を必須とするため、
 *   `documents/houteiSouzokuJohoIchiranzu.js`が参照する
 * @property {string} [address] 住所（任意）。法定相続情報一覧図に相続人の
 *   住所を記載する場合は、別途住民票の写し等の添付が必要になる
 *   （同条4項）。本モジュールは記載の要否を判定しない
 */

/**
 * @typedef {Object} FamilyStructureInput 法定相続人・法定相続分の
 *   自動計算に使う家族構成の入力（calcLegalHeirsの唯一の引数）
 * @property {string} caseId SuccessionCaseRecord.caseIdと対応する案件ID
 * @property {string} [decedentName] 被相続人の氏名（任意）。相続分の計算
 *   では使わないが、法定相続情報一覧図（不動産登記規則247条1項1号）は
 *   氏名・生年月日・最後の住所・死亡年月日の記載を必須とするため、
 *   `documents/houteiSouzokuJohoIchiranzu.js`が参照する
 * @property {string} [decedentBirthDateIso] 被相続人の生年月日（YYYY-MM-DD、任意）
 * @property {string} [decedentLastAddress] 被相続人の最後の住所（任意）
 * @property {string} decedentDeathDateIso 被相続人の死亡日（相続開始日。
 *   YYYY-MM-DD）。熟慮期間・相続税申告期限・遺留分侵害額請求の除斥期間
 *   〈10年〉の起点になる。法定相続情報一覧図の「死亡の年月日」も兼ねる
 * @property {string} [decedentDeathKnownDateIso] 相続人（代表者）が
 *   相続の開始を知った日。省略時はdecedentDeathDateIsoと同一とみなす。
 *   相続放棄の熟慮期間・相続税申告期限・遺留分侵害額請求の消滅時効
 *   〈1年〉は、原則としてこちらを起点とする（民法915条1項）
 * @property {boolean} hasSpouse 被相続人に法律上の配偶者がいるか
 *   （内縁関係は法定相続人にならないため対象外）
 * @property {boolean} [spouseIsAlive] hasSpouseがtrueの場合のみ有効。
 *   配偶者が相続開始時点で生存しているか
 * @property {HeirCandidateInput[]} children 被相続人の子（実子・養子を
 *   区別しない。非嫡出子との相続分差別は平成25年民法改正で撤廃済みの
 *   ため区別フィールドを設けない）
 * @property {HeirCandidateInput[]} ascendants 直系尊属（父母・祖父母等）。
 *   親等の近い者を優先する処理はcalcLegalHeirsが行う
 * @property {HeirCandidateInput[]} siblings 被相続人の兄弟姉妹
 */

/**
 * @typedef {Object} HeirShareResult 個々の法定相続人1名分の計算結果
 * @property {string} personId 入力のpersonId（代襲相続人の場合は
 *   代襲相続人自身のpersonId。配偶者は固定文字列"spouse"）
 * @property {string} [label]
 * @property {HeirResultRelation} relation
 * @property {string} shareFraction 相続分（既約分数の文字列表現。
 *   例: "1/4"。浮動小数点誤差を避けるため常に分数のまま保持する）
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
 * @property {string[]} warnings 機械計算では判断しきれない事項についての
 *   警告文一覧。必ず1件以上、末尾に「本計算はあくまで入力情報に基づく
 *   機械的な試算であり、戸籍謄本等の一次資料による確認前の最終確定情報
 *   として扱わないこと」という定型文を含める（FR-S1.9）
 * @property {boolean} allSharesSumToOne 内部検算: 相続分の合計が1に
 *   なっているかの自己チェック結果（実装バグ検出用）
 */

/**
 * @typedef {Object} SouzokuzeiKisokoujogakuResult
 *   calcSouzokuzeiKisokoujogakuの戻り値（相続税の基礎控除額の目安）
 * @property {number} houteiSouzokuninCount 相続税法15条2項に基づく
 *   「相続人の数」（calcLegalHeirsの実際の法定相続人数とは異なりうる。
 *   相続放棄があった場合は放棄がなかったものとして数え、養子は上限つきで
 *   算入する）
 * @property {"なし" | "子" | "直系尊属" | "兄弟姉妹"} bloodRank
 *   相続放棄を無視した場合にどの順位の血族が数えられたか（配偶者以外。
 *   calcLegalHeirsのpatternと異なり得る点に注意。例えば子が全員相続放棄した
 *   場合でも、本計算では子が数えられ直系尊属には移らない）
 * @property {number} kisokoujogakuYen 基礎控除額の目安（円）。
 *   3,000万円 + 600万円 × houteiSouzokuninCount
 * @property {string[]} warnings 養子の数が上限を超えて申告された場合の
 *   注意喚起、相続放棄者がいる場合の取り扱いの説明等。必ず末尾に
 *   「相続税額そのものの計算・申告は税理士の職域であり本モジュールの
 *   対応範囲外」である旨の定型文を含める
 */

/**
 * @typedef {Object} PropertyItem 財産目録1件分
 * @property {string} itemId 案件内で一意なID
 * @property {"不動産" | "預貯金" | "有価証券" | "自動車" | "その他"} category
 * @property {string} description 財産の表示（例: "〇〇銀行△△支店 普通預金"）。
 *   口座番号の全桁等、相続分計算・書類生成に不要な機微情報は含めない（NFR-S3）
 * @property {number} [estimatedValueYen] 概算評価額（円。任意。不明な
 *   場合は省略可。正式な相続税評価額の算定は本モジュールの対象外であり、
 *   あくまで参考値の扱いとする）
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
 *   知った日
 * @property {FamilyStructureInput} familyStructure 法定相続人算出に
 *   使った家族構成の入力（再計算・変更履歴確認用に保持する）
 * @property {LegalHeirsResult} [lastCalculatedResult] 直近の計算結果
 *   （キャッシュ。家族構成の変更のたびにcalcLegalHeirsを再実行し上書きする）
 * @property {SouzokuzeiKisokoujogakuResult} [lastKisokoujogakuResult]
 *   相続税の基礎控除額の目安の直近の計算結果（キャッシュ。lastCalculatedResult
 *   と同様、家族構成の変更のたびにcalcSouzokuzeiKisokoujogakuを再実行し
 *   上書きする）
 * @property {PropertyItem[]} [properties] 財産目録
 * @property {"遺産分割協議書作成中" | "自筆証書遺言作成支援中" | "完了" |
 *   "保留"} status 案件の進捗ステータス
 * @property {boolean} hasDisputeAmongHeirs 相続人間に争いの兆候があるか
 *   （自動判定はしない。発注者が人手で確認し記録するフラグ。trueの場合、
 *   本モジュールでの協議書作成支援を続行してよいか都度人手確認する。
 *   FR-S2.5・NFR-S1）
 * @property {string[]} [notes] 自由記述メモ
 */

export {};
