# アーキテクチャ方針

> 本書はアーキテクチャ方針の要約版。外部開発者への委託にあたっては、
> [`docs/REQUIREMENTS.md`](REQUIREMENTS.md)（要件定義書）、
> [`docs/DESIGN.md`](DESIGN.md)（技術設計書・モジュール詳細）、
> [`docs/DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md)（開発環境構築・コーディング規約・Git運用）
> もあわせて参照すること。

## 全体パイプライン

```
① インテイク（顧客からの情報収集）
        ↓
② 要件判定エンジン（src/core/eligibility/ + src/licenses/<種別>/eligibility/）
        ↓  ← ここで不足があれば申請前に顧客へフィードバック
③ 書類自動生成（src/core/documents/ + src/licenses/<種別>/documents/）
        ↓
④ 人手レビュー・職印押印 ★唯一、自動化できない必須ステップ
        ↓
⑤ 提出（JCIP電子申請 or 印刷パッケージ）
        ↓
⑥ 更新リマインドエンジン（src/core/reminders/ + src/licenses/<種別>/reminders/）→ ①へ戻る（次回更新・決算変更届等）
```

行政書士の独占業務（有償での官公署提出書類の作成・提出代理）は④の人手レビューに
集約されるよう設計している。①②③⑥をどれだけ自動化しても、④を省略することは
2026年の行政書士法改正下では違法になる（詳細は Obsidian Vault の
`15-行政書士/副業サービス構想.md` を参照）。

このパイプライン自体は許可種別（建設業許可・古物商許可等）によらず共通である
という発見をもとに、2026年9月に「許可種別非依存の共通コア（`src/core/`）＋
許可種別ごとの薄いアドオン（`src/licenses/<種別>/`）」という構造に整理する
リファクタリングを行った（`docs/DESIGN_kobutsu-core.md`参照）。コア側は
「建設業」「古物商」といった固有の許可種別名・法令名を一切知らない設計にして
おり、新しい許可種別を追加する際はアドオンを1つ追加してコアへ登録するだけで
済むことを、古物商許可モジュール（M11）の実装を通じて検証した。

## なぜ TypeScript ではなく JSDoc + 素のJavaScriptか

副業として平日夜間・週末にメンテナンスすることを想定し、ビルドステップ
（tsc等のコンパイル）を挟まずに `node` コマンドで直接実行できる構成にしている。
JSDocの型注釈により、VS Code等のエディタでは型補完・型チェックがほぼ
TypeScriptと同等に効く。

プロジェクトの規模が育ってきたため、`tsconfig.json`（`checkJs: true` /
`noEmit: true`）による型チェックをCIに導入済み（`npm run typecheck`）。
これは「コンパイル・ビルドステップを増やさずに型チェックだけ行う」もので、
`.js`ファイルを`.ts`に置き換えるものではない。詳細は
[ADR-0007](adr/0007-checkjs-type-checking.md) を参照。

## モジュール構成

M11（`docs/DESIGN_kobutsu-core.md`）で、許可種別に依存しない共通コア
（`src/core/`）と、許可種別ごとのアドオン（`src/licenses/<種別>/`）に
整理した。コア側は「建設業」「古物商」等の固有の許可種別名・法令名を
一切含まない設計にしている。

### 共通コア（`src/core/`）

- `src/core/eligibility/types.js` — 要件判定の共通型（`RequirementCheckResult`・`EligibilityResult`・`ConsistencyWarning`）。許可種別固有の巨大な型（`ApplicantProfile`等）は各アドオン側に置く
- `src/core/eligibility/aggregate.js` — 個別の判定結果配列から総合判定・レポートの共通部分を集約する許可種別非依存のロジック
- `src/core/documents/common.js` — 様式生成モジュール共通のdocxヘルパー（見出し・赤字注記・表・箇条書き・ファイル書き出し）
- `src/core/reminders/scheduleTypes.js` — 許可種別ごとのリマインド・スケジュール計算関数を登録・取得するレジストリ（`prefectureRules.js`と同じパターン）
- `src/core/reminders/dateUtils.js` — 許可種別に依存しない日数計算（`daysUntil`）
- `src/core/reminders/digest.js` — 複数クライアント（1クライアントが複数許可を保有可能、`ClientRecord`/`LicenseEntry`、ADR-0008）のリマインドを`scheduleTypes.js`経由で集計・整形、残日数バケット分類、メール下書きURL生成（M4・M7。実送信は行わない）
- `src/core/reminders/clientStore.js` — クライアント情報を `data/clients.json` へ読み書きするローカル永続化層（DB不使用。旧形式データ・`licenseCategory`未設定データの自動移行に対応）
- `src/core/reminders/clientCsv.js` — クライアント一覧とCSVの相互変換（1行＝1許可。バックアップ・一括登録用。外部パッケージ不使用）

### 建設業許可アドオン（`src/licenses/construction/`）

- `eligibility/types.js` — `ApplicantProfile`等、建設業許可固有のJSDoc型定義（要件判定・書類生成の入出力の唯一の情報源）
- `eligibility/rules/*.js` — 法定5要件それぞれの判定ロジック（1要件=1ファイル）
- `eligibility/engine.js` — 5要件（＋登録済みの都道府県固有要件）をまとめて判定し、総合結果とレポートを生成（集約部分はコアの`aggregate.js`を再利用）
- `eligibility/prefectureRules.js` — 都道府県固有の追加要件を登録・合成する仕組み（M6の土台。具体的な要件は未登録）
- `eligibility/consistencyChecks.js` — 入力内容のルールベース整合性チェック（M7。合否判定には影響しない付加情報。外部AI APIは使わない）
- `documents/youshiki1.js`・`youshiki2.js`（工事経歴書、M8）・`youshiki6.js`・`youshiki7.js`・`youshiki8.js`・`youshiki16.js`（完成工事原価報告書、M10）・`youshiki20-2.js`・`youshiki25-14.js`（経審総括表、M9） — 各様式のdocx自動生成
- `reminders/renewalSchedule.js` — 5年更新（早期検討180日前・準備開始60日前・法定期限30日前の3段階、M7）・決算変更届の期限計算
- `index.js` — `registerConstructionLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント

### 古物商許可アドオン（`src/licenses/kobutsu/`。M11新規・第2のパイロット）

- `eligibility/types.js` — `KobutsuApplicantProfile`等、古物商許可固有のJSDoc型定義
- `eligibility/kekkaku.js` — 古物営業法第4条の欠格事由（一号〜九号）の判定
- `eligibility/eigyosho.js` — 営業所・管理者要件（第13条）の判定
- `eligibility/engine.js` — 上記2要件をまとめて判定（集約部分はコアの`aggregate.js`を再利用）
- `eligibility/consistencyChecks.js` — 入力内容の整合性チェック（2026年9月追加。建設業許可の`consistencyChecks.js`と同じ設計思想。生年月日の妥当性・管理者の複数営業所重複・未成年者例外フラグの矛盾を検出。合否判定には影響しない）
- `documents/shinseisho.js`（許可申請書）・`seiyakusho.js`（誓約書）・`rirekisho.js`（略歴書） — 各様式のdocx自動生成
- `reminders/changeSchedule.js` — 書換申請（変更日から14日以内）・許可証返納（廃業日から10日以内）の期限計算、変更届出（3日以内）の即時警告
- `index.js` — `registerKobutsuLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 法人申請・Webフォーム対応は対象外（`docs/REQUIREMENTS_kobutsu-core.md` 4.6節）

### 産業廃棄物収集運搬業許可アドオン（`src/licenses/sanpai/`。コアの3例目）

- `eligibility/types.js` — `SanpaiApplicantProfile`等、産廃許可固有のJSDoc型定義
- `eligibility/kekkaku.js` — 廃棄物処理法第14条第5項第2号の欠格事由（第7条第5項第4号イ〜チを包含）の判定
- `eligibility/koushu.js` — JWセンター講習修了証の有効性（発行日から5年以内）の判定
- `eligibility/keiriKiso.js` — 経理的基礎（直近期の債務超過のみの簡易判定）の判定
- `eligibility/shisetsu.js` — 運搬施設（車両・容器等）の飛散・流出・悪臭防止措置の判定（自己申告＋人手確認警告）
- `eligibility/engine.js` — 上記4要件をまとめて判定（集約部分はコアの`aggregate.js`を再利用）
- `documents/shinseisho.js`（許可申請書）・`jigyokeikakusho.js`（事業計画書。運搬車両一覧を表形式で出力） — 各様式のdocx自動生成
- `reminders/renewalAndKoushuSchedule.js` — 許可更新（有効期間5年 or 優良認定で7年。施行令第6条の9）・講習修了証期限（発行日から5年）の2種のリマインド計算。月単位丸め計算の実体は建設業許可と共有する`src/core/reminders/expirySchedule.js`
- `index.js` — `registerSanpaiLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 特別管理産業廃棄物・積替え保管を伴う許可・複数都道府県同時申請は対象外（`docs/REQUIREMENTS_sanpai-core.md` 4.6節）

### 住宅宿泊事業（民泊）届出アドオン（`src/licenses/minpaku/`。コアの4例目）

届出制のため、他の許可種別のような裁量的な合否判定ではなく「届出の準備が
整っているか」の確認が中心（`docs/REQUIREMENTS_minpaku-core.md` 1.2節）。

- `eligibility/types.js` — `MinpakuApplicantProfile`等、民泊届出固有のJSDoc型定義
- `eligibility/kekkaku.js` — 住宅宿泊事業法第4条の欠格事由の判定
- `eligibility/documentChecklist.js` — 必要書類（登記事項証明書・図面・消防法令適合通知書 等）の充足チェックリスト（合否判定ではなく準備状況の可視化）
- `eligibility/residentType.js` — 家主居住型/家主不在型の確認（家主不在型で管理業者未確定なら警告。常に合否には影響しない）
- `eligibility/engine.js` — 上記3項目をまとめて確認（集約部分はコアの`aggregate.js`を再利用）
- `documents/todokedesho.js`（届出書）・`seiyakusho.js`（誓約書）・`checklist.js`（必要書類チェックリスト） — 各様式のdocx自動生成
- `reminders/periodicReportSchedule.js` — 定期報告（宿泊実績）の次回期限計算。**暦日固定型（新パターン）**: 施行規則第12条第2項により、報告実績・届出日に依存せず、毎年2/4/6/8/10/12月15日のうち直近で到来する日が次回期限になる。既存の「満了日ベース」（建設業許可・産廃許可）・「変更トリガー型」（古物商許可）とは異なる第3のリマインド方式だが、`ScheduleFn`契約自体（`(license) => ScheduleItem[]`）は変更せず、関数内部で`new Date()`により本日を取得することで対応できることを実証した
- `index.js` — `registerMinpakuLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 電子申請の自動化・住宅宿泊管理業者の選定支援・消防法令適合通知書の取得代行・複数物件の一括管理は対象外（`docs/REQUIREMENTS_minpaku-core.md` 4.5節）

### 在留資格「技術・人文知識・国際業務」申請支援アドオン（`src/licenses/gijinkoku/`。コアの5例目）

事業提案の柱（C）「外国人材関連（中長期）」の第一弾。**他の4モジュールより
専門性・リスクが高い分野**を扱う（`docs/REQUIREMENTS_gijinkoku-core.md` 1.3節）。
申請取次（本人に代わり出入国在留管理局窓口へ出頭・提出する行為）には、
行政書士登録に加えて別途の届出・研修が必要であり、本ツールはあくまで
書類準備支援に留まる。在留資格変更許可申請・技能実習/特定技能等の他の
在留資格は対象外（新規招へいの認定証明書交付申請のみ）。

- `eligibility/types.js` — `GijinkokuApplicantProfile`等のJSDoc型定義。外国人本人の旅券番号等の識別情報は含めない（NFR-G1）
- `eligibility/gakureki.js` — 学歴・実務経験要件の判定。入管法基準省令の項目一（自然科学/人文科学分野。学歴要件または10年の実務経験）・項目二（国際業務区分。原則3年の実務経験。大学卒業者が通訳/翻訳/語学の指導に従事する場合のみ実務経験要件が免除）で判定構造が異なる点を反映
- `eligibility/hoshu.js` — 報酬要件（日本人が従事する場合と同等額以上）の判定
- `eligibility/kanrensei.js` — 専攻・職務内容の関連性。審査官の裁量が大きく機械判定が困難なため、建設業許可の`seijitsusei.js`と同様、常に`passed: true`＋人手確認を促す警告のみを返す
- `eligibility/disclaimer.js` — 一次スクリーニングの強調文言（`GIJINKOKU_SCREENING_NOTICE`）。判定結果・docx出力の両方に付与する（NFR-G2）
- `eligibility/engine.js` — 上記3要件をまとめて判定し、強調文言を冒頭・末尾に付加した専用フォーマッタ（`formatGijinkokuEligibilityReport`）を提供
- `documents/ninteiShinseisho.js`（認定証明書交付申請書。新規招へい用）・`henkoShinseisho.js`（在留資格変更許可申請書。既に日本国内にいる外国人が現に有する在留資格から変更する場合用。入管法20条。2026年9月追加。学歴・報酬要件等の判定ロジックはninteiShinseisho.jsと完全に共有し、書類側のみ「現に有する在留資格」等の項目を追加する）・`checklist.js`（所属機関カテゴリー別 添付書類チェックリスト。**カテゴリーごとの詳細な必要書類一覧は行政上の運用要領〈提出書類チェックシートPDF〉に基づく参考情報であり、申請直前に出入国在留管理庁公式サイトで必ず再確認する旨を明記**） — 各様式のdocx自動生成
- `reminders/zairyuKikanSchedule.js` — 在留期間満了リマインド（**可変期間の有効期限型。第四のリマインドパターン**）。在留期間が3月/1年/3年/5年と可変で許可日から一意に計算できないため、建設業許可・産廃許可と異なり「満了日そのもの」を`gijinkokuDetail.expiryDateIso`として直接入力に受け取る設計。更新申請の特例期間（満了後2ヶ月まで。出入国在留管理庁公式サイトで確認済み）を締切リマインドのラベルに明記
- `index.js` — `registerGijinkokuModule()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 所属機関カテゴリーの区分基準自体は法令ではなく行政上の運用要領に基づくため自動判定はせず、利用者の手入力を前提とする。情報処理技術の資格保有等による学歴/実務経験要件の免除規定（法務大臣告示）は一次資料で検証できないため対象外（`docs/REQUIREMENTS_gijinkoku-core.md` 4.5節・FR-G1.2）

### 経営事項審査（経審）申請支援アドオン（`src/licenses/keiei-jiko-shinsa/`。コアの6例目）

これまでのモジュールと異なり「新しい許可種別への横展開」ではなく、
**既存の建設業許可クライアントへのクロスセル**という位置づけ。経審は
建設業許可を受けていることが前提条件であり、本モジュールは初めて
**同一`ClientRecord`内の他の`LicenseEntry`（`licenseCategory: "construction"`）
を読む**アドオン間連携を行う（コア側の型・関数は無変更）。

- `eligibility/prerequisite.js` — `checkKeieiJikoShinsaPrerequisite(input, clientRecord)`。他モジュールと異なり`ClientRecord`全体を受け取り、建設業許可の保有・決算変更届の提出状況・業種区分の選択を確認する
- `eligibility/inputCompleteness.js`・`yStatus.js` — X1・X2・Z・Wの入力完備性チェック、Y（経営状況分析）の申請状況チェック。**評点（X1〜W・総合評定値P）そのものは計算しない**（国土交通省の評点テーブルは毎年度改定され得るため精密な再現は対象外。docs/DESIGN_keiei-jiko-shinsa-core.md 1章）
- `eligibility/engine.js` — 上記3項目をまとめて「準備状況」として確認（合否判定ではなく産廃・民泊と同様の可視化パターン）
- `documents/keieikiboHyouka.js`（経営規模等評価申請書）・`keieijoukyouBunseki.js`（経営状況分析申請書）・`checklist.js`（必要書類チェックリスト） — 各様式のdocx自動生成
- `reminders/annualCycleSchedule.js` — **年次反復型（第5のリマインドパターン）**。有効期限（施行規則で確認済み: 審査基準日から1年7ヶ月）を切らさないよう、直近の審査基準日から翌年の審査基準日を推定し、決算変更届提出期限・再受審推奨時期・現行結果の有効期限の3件を算出する
- `index.js` — `registerKeieiJikoShinsaLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 評点・総合評定値の計算、登録経営状況分析機関の選定支援は対象外（`docs/REQUIREMENTS_keiei-jiko-shinsa-core.md` 4.6節）

### 農地転用許可アドオン（`src/licenses/nouchi-tenyo/`。コアの7例目）

建設業許可・産廃許可の既存クライアント層との重なりが大きい分野。農地転用
許可には他の許可種別のような「更新（有効期限）」の概念が無く、代わりに
許可条件として個別の期限（工事着手期限・完了報告期限等）が付されることが
多い、という他の許可種別とは異なる構造を持つ。

- `eligibility/types.js` — `NouchiTenyoApplicantProfile`等のJSDoc型定義
- `eligibility/ricchiKijun.js` — 立地基準（農地区分：農用地区域内農地・甲種農地・第1種農地・第2種農地・第3種農地）の判定。**農地区分の最終認定は農業委員会・都道府県が行うものであり、本判定は自己申告に基づく形式的な一次判定に過ぎない旨を必ずwarningsに含める**（NFR-N1）
- `eligibility/ippanKijun.js` — 一般基準（転用の確実性・周辺農地への被害防除措置）の判定
- `eligibility/engine.js` — 上記2要件をまとめて判定（集約部分はコアの`aggregate.js`を再利用）
- `documents/shinseisho.js`（許可申請書）・`jigyokeikakusho.js`（事業計画書。資金調達内訳を`buildHeaderedTable`で表形式出力） — 各様式のdocx自動生成
- `reminders/conditionDeadlineSchedule.js` — **条件履行期限型（第6のリマインドパターン）**。許可証に個別記載された期限日（工事着手期限・完了報告期限・一時転用の農地復元期限〈2026年9月追加〉）をそのまま入力として受け取り、履行済みフラグが記録されるとリマインドが自動的に消える。期限超過時のラベル文言に許可取消し（農地法第51条）リスクの注記を常に含める設計とし、`ScheduleFn`のシグネチャ（今日の日付を引数に取らない）は変更していない。「一時転用」は農地法の条文上の用語ではなく、恒久転用と同じ4条・5条の許可の枠組み内で復元期限という条件が付される行政運用上の呼称であるため（2026年9月・e-Gov法令検索で確認）、既存の条件履行期限型パターンをそのまま適用できた
- `index.js` — `registerNouchiTenyoLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 市街化区域内の届出案件・農地法第3条許可・農振除外手続は対象外（`docs/REQUIREMENTS_nouchi-tenyo-core.md` 4.6節。一時転用の農地復元期限管理は2026年9月に対応済み）

### 飲食店営業許可アドオン（`src/licenses/inshokuten-eigyo/`。コアの8例目）

一般消費者からの依頼が多い分野。HACCPに沿った衛生管理は許可要件では
なく継続義務という区別が要点（1.3節参照）。

- `eligibility/types.js` — `InshokutenApplicantProfile`等のJSDoc型定義。HACCP関連フィールドは意図的に持たせない
- `eligibility/disclaimer.js` — **e-Gov法令検索で確認済み（2026年9月）**。食品衛生法第55条第2項の許可拒否事由にHACCP実施状況は含まれず、同法第51条に基づく別個の継続的遵守義務であることを`HACCP_CONTINUING_OBLIGATION_NOTICE`として明文化
- `eligibility/shisetsuKijun.js` — 施設基準（シンク数・手洗い設備の構造・材質・換気・給排水）の判定。令和3年改正で明確化された「洗浄後の手指の再汚染防止構造」を必須項目に含める
- `eligibility/sekininsha.js` — 食品衛生責任者の設置要件の判定
- `eligibility/engine.js` — 上記2要件をまとめて判定（HACCPは判定対象に含めない）
- `documents/shinseishoSummary.js`（営業許可申請書サマリー）・`tenpuChecklist.js`（添付書類チェックリスト＋事前相談→実地検査→許可証交付の標準的な流れの案内） — 各様式のdocx自動生成
- `reminders/koshinSchedule.js` — **可変期間型の一般化**。建設業許可・産廃許可が確立した「許可年月日＋有効期間年数」から満了日を計算するコア共通ロジック（`src/core/reminders/expirySchedule.js`の`calcExpirySchedule`）を、産廃許可の「5年or7年の2択」からさらに一般化し、自治体・施設の立入検査結果で個別に決まる可変の年数（5〜8年が目安。食品衛生法第55条第3項は「5年を下らない」とのみ定め上限を定めていない）に対応。`validityYears`が未入力（＝許可証交付前）の場合は空配列を返す
- `index.js` — `registerInshokutenEigyoLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 深夜酒類提供飲食店営業届出・風俗営業許可（風俗営業法）、酒類販売業免許（酒税法）、飲食店営業以外の食品衛生法上の許可業種、自治体ごとの施設基準条例の網羅的データベース化は対象外（`docs/REQUIREMENTS_inshokuten-eigyo-core.md` 4.6節）

### 特定技能1号申請支援アドオン（`src/licenses/tokutei-ginou/`。コアの9例目）

事業提案の柱（C）「外国人材関連」の第2弾。gijinkoku（技人国ビザ）同様、
専門性・リスクが高い分野を扱うため一次スクリーニングの強調文言を全出力に
付与する。gijinkokuと異なり、対象分野ごとに技能試験名・分野特有の日本語
試験要否等が変わるため、モジュール内部に「分野別サブレジストリ」
（`prefectureRules.js`と同型のパターンだが、コア横断のレジストリ
〈`scheduleTypes.js`〉とは別物でモジュール内部限定）を新設した点が特徴。

- **e-Gov法令検索で確認・修正済み（2026年9月）**: 当初提案書は「2026年9月
  時点で16分野」としていたが、2026年4月1日施行の省令改正（「出入国管理
  及び難民認定法別表第一の二の表の特定技能の項の下欄に規定する産業上の
  分野等を定める省令」平成三十一年法務省令第六号）により対象分野が
  **19分野**（林業・木材産業・資源循環の3分野が新規追加）へ拡大している
  ことを確認し、`docs/REQUIREMENTS_tokutei-ginou-core.md`・
  `docs/DESIGN_tokutei-ginou-core.md`の該当箇所を修正した
  （ドキュメント修正PRを実装着手前にマージ）。義務的支援10項目
  （平成三十一年法務省令第五号第3条イ〜ヌ）・報酬同等以上要件
  （同令第1条第1項第3号）は当初の記載どおり正確であることも確認した
- `eligibility/types.js` — `TokuteiGinouApplicantProfile`等のJSDoc型定義
- `eligibility/fieldRegistry.js`・`fieldRegistry.seed.js` — 対象19分野を`fieldKey`で登録・参照するモジュール内部限定のサブレジストリ（分野ラベル・技能試験名・分野特有の日本語試験要否〈介護分野のみ`requiresSectorSpecificJapaneseTest: true`〉・特定技能2号への移行対象分野か〈`supportsSpecifiedSkilled2`。2026年9月追加。介護等を除く11分野が対象〉を保持。3新分野の技能試験名は暫定表記のため要再確認の旨をコメントで明示）
- `eligibility/ginouSuijun.js` — 分野別技能試験合格等による技能水準要件の判定
- `eligibility/nihongoNouryoku.js` — 日本語能力要件（JLPT N4相当以上等）の判定。介護分野は分野特有の日本語評価試験も確認
- `eligibility/shozokuKikanKijun.js` — 所属機関（受入れ企業）側の基準（報酬同等以上・支援体制確保等）の判定
- `eligibility/shienTaisei.js` — 支援計画の実施体制（自社支援 or 登録支援機関への委託）の判定
- `eligibility/disclaimer.js` — 一次スクリーニングの強調文言。gijinkokuと同じ設計パターン
- `eligibility/engine.js` — 上記4要件をまとめて判定
- `documents/ninteiShinseisho.js`（在留資格認定証明書交付申請書サマリー）・`shienKeikakusho.js`（支援計画書サマリー）・`checklist.js`（添付書類チェックリスト） — 各様式のdocx自動生成
- `reminders/tokuteiGinouSchedule.js` — 在留期間満了リマインド（gijinkokuの可変期間型`calcZairyuKikanSchedule`と同じ設計）に加え、**通算在留期間5年上限への接近警告**という第2のリマインド軸を同一の`ScheduleItem[]`に混在させる。5年上限は出入国管理及び難民認定法の条文自体には見当たらず、同法第2条の3が策定を義務付ける「基本方針」（運用レベルの指針）に基づくものと考えられるため、条文引用をせず「運用上の上限」という前提を明記した近似計算（暦年加算）とした。通算在留期間の正確な計算方法（出国期間・特例期間・端数の扱い）は一次資料未確認のため、個別ケースでは人手確認を促す設計。`resolveGonenJougenGuidance`（2026年9月追加）が`fieldRegistry.js`の`supportsSpecifiedSkilled2`に基づき、5年上限接近時の案内文言を「2号移行の検討」または「在留資格の見直しが必要」に出し分ける
- `index.js` — `registerTokuteiGinouModule()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 特定技能2号（家族帯同可・在留期間上限なし）への移行支援、技能実習からの移行要件、特定産業分野ごとの詳細な受入れ人数枠管理は対象外（`docs/REQUIREMENTS_tokutei-ginou-core.md` 4.6節）

### BtoB下請けケース管理ポータル（`src/portal/`。許可種別アドオンではない独立ドメイン）

事業提案の柱（A）「BtoB下請け」（他の行政書士から書類作成業務を受注する側の
業務）を支援するケース管理ツール。柱（B）の許可種別アドオン群とは異なり、
許可の要件判定（`src/core/eligibility/`）は対象外で、コアが提供する
「docx共通ヘルパー」「リマインド表示関数（`bucketizeAlerts`・
`formatReminderDigest`）」のみを再利用する（`docs/DESIGN_uketsuke-portal.md`
1章）。

- `types.js` — `PartnerRecord`（元請行政書士）・`CaseRecord`（案件）のJSDoc型定義。`ApplicantProfile`・`ClientRecord`とは意図的に型を共有しない（NFR-U2）
- `caseStore.js` — `data/partners.json`・`data/cases.json`への永続化（`clientStore.js`と同じ設計パターン。`withFileLock`によるread-modify-write直列化を含む）
- `documents/mitsumorisho.js`（見積書）・`seikyusho.js`（請求書） — 各様式のdocx自動生成。国・自治体が定める「様式」ではないため`buildDisclaimerParagraph`は使わない
- `documents/monthlySeikyusho.js`（月次請求サマリー。FR-U2.3。2026年9月追加）— 1つの元請に対する「当月完了分」の複数案件をまとめて一覧化し合計金額を算出する任意機能。`CaseRecord.completedDateIso`（同時に追加した任意フィールド）で絞り込む。`dueDateIso`（納期）は予定日に過ぎず実際の完了日と一致しないことがあるため、絞り込みには使わない
- `reminders/caseDeadlines.js` — 案件の納期から`ReminderAlert`相当を生成。**あえて`registerScheduleFn`（許可のレジストリ）を使わない設計**: 案件を`LicenseEntry`として無理に扱うとコアが許可種別以外の概念を抱え込んでしまうため、表示用の関数（`bucketizeAlerts`等）だけをコアから再利用し、許可のリマインド一覧（`buildReminderDigest`）とは別コマンド・別出力として扱う（`docs/DESIGN_uketsuke-portal.md` 5章）
- `scripts/portal-*.js` — 元請・案件の登録/一覧/ステータス更新・納期リマインド表示・月次請求サマリー生成のCLI。`portal-update-case-status.js`はステータスを「完了」にする際、完了日（`completedDateIso`）を省略すると本日の日付を自動設定する
- Web一覧表示・オンライン決済・複数案件の月次請求サマリーは対象外（`docs/REQUIREMENTS_uketsuke-portal.md` 4.6節）

### 会社設立サポート（`src/incorporation/`。許可種別アドオンではない独立ドメイン）

株式会社・合同会社の設立に際して必要な定款・付随書類の作成支援を行う。
BtoB下請けポータルと同じく「許可の可否を判定する」業務ではないため、
要件判定エンジン（`src/core/eligibility/`）・許可レジストリ
（`registerScheduleFn`）のいずれにも依存せず、コアが提供する
「docx共通ヘルパー」「リマインド表示関数（`bucketizeAlerts`・
`formatReminderDigest`）」のみを再利用する（`docs/DESIGN_kaisha-secchi-support.md`
1章・NFR-I2）。

- **職域境界の担保（設計原則）**: 設立登記の申請・登記申請書の作成は
  司法書士の独占業務（司法書士法第3条・第73条・第78条。e-Gov法令検索で
  確認済み・2026年9月）であるため、`documents/`配下に登記申請書または
  それに類する様式（就任承諾書〈登記添付書類としてのもの〉等）を一切
  実装しない（NFR-I3）
- `types.js` — `FounderInput`・`TeikanInput`（定款作成データ）・`IncorporationCaseRecord`のJSDoc型定義。`ApplicantProfile`・`ClientRecord`・`CaseRecord`（portal）とは意図的に型を共有しない
- `caseStore.js` — `data/incorporation-cases.json`への永続化（`clientStore.js`・`portal/caseStore.js`と同じ設計パターン。`withFileLock`によるread-modify-write直列化を含む）
- `documents/teikanSummary.js`（定款サマリー。会社形態〈株式会社/合同会社〉により出力項目が分岐。出資額合計の整合性チェックも含む。合同会社は`isDaihyoShain`に基づく「代表社員」行を表示）・`hokininKetteisho.js`（発起人決定書サマリー。株式会社のみ。合同会社を指定するとエラー）・`daihyoShainGosensho.js`（代表社員の互選書サマリー。合同会社のみ。株式会社を指定するとエラー。会社法599条3項に基づき、定款外で社員間の互選を書面化する。2026年9月追加） — 各様式のdocx自動生成
- **合同会社の絶対的記載事項は6項目**（会社法第576条第1項第5号「社員が無限責任社員又は有限責任社員のいずれであるかの別」が株式会社〈第27条・5項目〉側に対応項目のない追加事項として存在する。同条第4項により合同会社では内容が固定されるため、`teikanSummary.js`で定型文の行として出力する。当初提案書の「両形態とも5項目」という誤りをe-Gov法令検索で発見・修正した経緯は`docs/DESIGN_kaisha-secchi-support.md` 3.1節参照）
- `reminders/incorporationSchedule.js` — 定款認証予約日（株式会社のみ）・出資金払込期限から`ReminderAlert`相当を生成。**あえて`registerScheduleFn`を使わない設計**（案件ごとに一度きりの単発の期日であり、`LicenseEntry`として扱う必然性が薄いため。`docs/DESIGN_uketsuke-portal.md`と同じ設計判断）。許可のリマインド一覧・BtoB下請け案件の納期一覧とは別コマンド・別出力として扱う
- `scripts/incorporation-*.js` — 案件の登録・納期リマインド表示のCLI
- 設立登記の申請書類作成・募集設立・株式会社以外の機関設計の詳細な定款条項生成・一般社団法人等の他法人形態・会社設立後の税務署等への届出書類作成は対象外（`docs/REQUIREMENTS_kaisha-secchi-support.md` 4.7節）

### 相続関連（遺言書・遺産分割協議書）支援（`src/succession/`。許可種別アドオンでも要件判定エンジンでもない独立ドメイン）

法定相続人・法定相続分の自動計算（民法900条・901条）、財産目録・遺産
分割協議書・自筆証書遺言文案の作成支援を行う。これまでのアドオン群とも
BtoB下請けポータル・会社設立サポートとも異なり、判定するのは「合否」
ではなく「分配」であるため、コアの判定型（`RequirementCheckResult`・
`EligibilityResult`・`aggregateEligibility`）も使わず、独自の結果型
`LegalHeirsResult`を新設する（`docs/DESIGN_souzoku-support.md` 1.3節）。
コアの`registerScheduleFn`（許可レジストリ）も使わず、「docx共通
ヘルパー」「リマインド表示関数（`bucketizeAlerts`・`formatReminderDigest`）」
のみを再利用する。

- **e-Gov法令検索で確認済み・2026年9月**: 民法887条（子及びその代襲者等の
  相続権）・889条（直系尊属及び兄弟姉妹の相続権）・891条〜893条（欠格・
  廃除）・900条（法定相続分）・901条（代襲相続人の相続分）・915条1項
  （熟慮期間3ヶ月）・939条（相続放棄の効力）・968条（自筆証書遺言）・
  1042条（遺留分の割合。直系尊属のみ1/3、それ以外〈兄弟姉妹を除く〉1/2）・
  1048条（遺留分侵害額請求権の期間制限）、相続税法27条・33条（申告・
  納付期限10ヶ月）を確認し、提案書の内容が正確であることを検証した
  （誤りは見つからず、ドキュメント修正PRなしで実装に着手した）。2026年9月、
  相続税の基礎控除額の目安表示機能の追加にあたり相続税法15条（遺産に係る
  基礎控除）もあわせて確認した
- `types.js` — `HeirCandidateInput`・`FamilyStructureInput`・`LegalHeirsResult`・`PropertyItem`・`SuccessionCaseRecord`のJSDoc型定義。マイナンバー（個人番号）フィールドは一切持たせない（NFR-S2）。氏名（`label`）は任意項目とし、続柄ラベルのみでも運用できる（NFR-S3）
- `heirs/fraction.js` — 相続分を`BigInt`による既約分数で扱う内部専用ユーティリティ（浮動小数点の丸め誤差を回避。NFR-S5）
- `heirs/calcLegalHeirs.js` — **本モジュールの中核**。`resolveLine`という1つの再帰関数（本人が有効なら`share:1`、無効なら代襲相続人を再帰的にたどり、系統内に誰もいなければ空配列）で、相続放棄（代襲なし）・死亡/欠格/廃除＋代襲あり・代襲相続人も全員無効・再代襲の4パターンを統一的に処理する。子の代襲は再代襲まで続く（887条3項）が、兄弟姉妹の代襲は甥姪の1代限り（889条2項は887条3項を準用しない）という非対称性を`allowReRepresentation`フラグで表現する。**実装時に設計書サンプルコードの2箇所の不具合を修正**: (1) 直系尊属の欠格・廃除該当者が除外されていなかった、(2) 兄弟姉妹の代襲相続人（甥姪）自身の欠格・廃除該当性がチェックされていなかった（いずれも891条・892条・893条は続柄を問わず適用されるため、子・兄弟姉妹本人と同様の除外条件が必要）
- `documents/zaisanMokuroku.js`（財産目録）・`isanBunkatsuKyogisho.js`（遺産分割協議書。`hasDisputeAmongHeirs`が真の案件では職域外警告を強調表示。FR-S2.5）・`jihitsushoshoYuigon.js`（自筆証書遺言文案。本文〈自書必須〉と財産目録部分〈968条2項により自書不要〉を区別し、遺留分の目安チェック〈1042条に基づく近似計算。兄弟姉妹は対象外〉、任意の遺言執行者指定条項〈`executorName`オプション。民法1006条1項。2026年9月追加〉を含む）・`houteiSouzokuJohoIchiranzu.js`（法定相続情報一覧図サマリー。不動産登記規則247条1項に基づく被相続人・相続人の氏名/生年月日/続柄等の記載内容確認用。法務局公表の正式な家系図レイアウトには対応しない。2026年9月追加） — 各様式のdocx自動生成
- `heirs/kisokoujogaku.js` — 相続税の基礎控除額の目安（`calcSouzokuzeiKisokoujogaku`）。相続税法15条2項に基づき、`calcLegalHeirs`とは別の「相続人の数」を数える（相続放棄があった場合は放棄がなかったものとみなす点、養子の数に上限〈実子がいれば1人・いなければ2人まで〉がある点が実際の法定相続人数と異なる）。`HeirCandidateInput.isAdopted`（本機能のために追加した任意フィールド。相続分の計算では参照しない）を使って養子を区別する
- `caseStore.js` — `data/succession-cases.json`への永続化。`upsertCase`が`familyStructure`変更のたびに`calcLegalHeirs`・`calcSouzokuzeiKisokoujogaku`を自動再計算し`lastCalculatedResult`・`lastKisokoujogakuResult`を更新する
- `reminders/souzokuDeadlines.js` — 相続放棄（3ヶ月）・相続税申告（10ヶ月）・遺留分侵害額請求（1年/10年）の期限リマインド。各ラベルに担当すべき専門家（弁護士・司法書士・税理士）を明記し、本モジュールが行うのは期限の「見える化」までであることを担保する（FR-S4.4）
- `scripts/succession-*.js` — 案件の登録・期限リマインド表示のCLI
- 数次相続・相続税評価額の算定・相続登記手続き・相続放棄申述書等の家庭裁判所提出書類の作成・遺産分割調停/審判の申立書作成・紛争性がある場合の代理交渉は対象外（`docs/REQUIREMENTS_souzoku-support.md` 4.6節）

### Web・共通

- `src/web/server.js` — インテイク用の簡易Webフォーム（M3。建設業許可のみ対応）＋リマインド表示・残日数フィルタ（`/reminders`、M7）＋下書き保存（`/drafts`）＋CSVダウンロード（`/clients.csv`）。node:http のみで実装し、127.0.0.1のみで待受
- `src/web/draftStore.js` — インテイクフォームの入力途中データを `data/drafts.json` へ読み書きするローカル永続化層（DB不使用）
- `test/` — `node --test` で実行するユニットテスト（外部テストランナー不要）
- `scripts/` — 動作確認用のサンプル実行スクリプト（`sampleProfile.js`・`sampleKobutsuProfile.js`が各許可種別共通のダミーデータ）

## 既知の未実装・今後の拡張ポイント

- 正式な様式（国交省・都道府県指定のレイアウト）への完全準拠したPDF/docx出力
  （現状は内容確認用のサマリー表のみ）
- 様式第二十号の二（誓約書）は本ツールが判定に用いる欠格要件10項目
  （2026年9月に6→10項目へ拡充。第1・2・3・5・6・7・8・9・10・14号相当）を
  確認しているが、建設業法第8条の全14号への完全対応はしていない。
  未対応の第4・11・12・13号は、申請者本人以外の複数人物（役員・使用人・
  法定代理人）ごとの欠格状況の保持が必要で、個人の申請者1名を前提とする
  現行の`ApplicantProfile`型では表現できないため対象外
  （`src/licenses/construction/eligibility/types.js`のKekkakuInput定義コメント参照）
- JCIP外部インターフェイス仕様書に沿ったデータ連携（電子申請の自動化）。
  仕様書の存在・概要（XML形式、2026年9月時点でv1.3が公開）は調査済みだが、
  行政書士登録・対象都道府県の確定・仕様書本文の精査が完了するまでは
  実装しない方針（`docs/adr/0006-jcip-integration-deferred.md`）
- 都道府県ごとの提出書類・様式差異の吸収（本ツールはまず自都道府県分から
  着手する想定）。「共通要件＋都道府県固有要件」を合成する仕組み自体は
  実装済み（`src/licenses/construction/eligibility/prefectureRules.js`、`docs/adr/0005-*.md`）だが、
  対象都道府県が未確定のため、具体的な追加要件は1件も登録されていない
- 更新リマインドの通知チャネル（メール等）との連携。`src/core/reminders/digest.js` で
  「今どのリマインドが必要か」の計算・整形、`clientStore.js` によるローカル
  永続化までは実装済みだが、実際の自動送信機能は未実装
  （外部サービス連携の要否を含め要検討）
- 古物商許可のWebフォーム対応（`src/web/`は建設業許可専用のまま）・
  法人申請対応（`docs/DESIGN_kobutsu-core.md` 9章「今後の拡張ポイント」
  参照。整合性チェックは2026年9月に実装済み）
- `src/core/reminders/clientCsv.js`は各種`<種別>Detail`をCSV列としては
  意図的に持たせていない（`docs/DESIGN_kobutsu-core.md` 5.5節参照）。CSV
  エクスポート/インポートでは`<種別>Detail`が失われるため、これらを使う
  クライアントはCSVではなく`scripts/add-client.js`または
  `data/clients.json`の直接編集で管理すること
  （2026年9月・`scripts/add-client.js`が`--license-category`と
  種別ごとの詳細フラグに対応済み。`npm run client:add -- --help`相当は
  無いため、スクリプト冒頭のコメントで使い方を確認すること）
- 産廃許可の優良認定（`sanpaiDetail.validityYears`が7年になる基準。環境省令）
  そのものの判定機能は無く、利用者が別途確認して入力する前提の参考値である
  （`docs/DESIGN_sanpai-core.md` 4.3節参照）
- Webフォーム（M3）は単一プロセス・単一ユーザーのローカル利用を想定した最小構成。
  クライアント情報は単一JSONファイル（`data/clients.json`）で管理しており、
  本格的なデータベース・認証・複数ユーザー対応は範囲外

## 法的な前提（重要）

- このツールの判定結果は「申請前のセルフチェック・一次スクリーニング」であり、
  最終的な適格性の判断・書類作成・提出の責任は、登録された行政書士本人が負う。
- 試験合格・行政書士登録が完了するまで、このツールを使って有償で
  書類作成・提出代理を行うことはできない。

## Git CLI ワークフロー

このリポジトリの操作（コミット・push等）は、GUIツール（Forkなど）ではなく
`git` CLI（Git CMD）で完結させる運用に統一している。
