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
- `documents/shinseisho.js`（許可申請書）・`seiyakusho.js`（誓約書）・`rirekisho.js`（略歴書） — 各様式のdocx自動生成
- `reminders/changeSchedule.js` — 書換申請（変更日から14日以内）・許可証返納（廃業日から10日以内）の期限計算、変更届出（3日以内）の即時警告
- `index.js` — `registerKobutsuLicense()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 法人申請・Webフォーム対応・整合性チェックは対象外（`docs/REQUIREMENTS_kobutsu-core.md` 4.6節）

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
- `documents/ninteiShinseisho.js`（認定証明書交付申請書）・`checklist.js`（所属機関カテゴリー別 添付書類チェックリスト。**カテゴリーごとの詳細な必要書類一覧は行政上の運用要領〈提出書類チェックシートPDF〉に基づく参考情報であり、申請直前に出入国在留管理庁公式サイトで必ず再確認する旨を明記**） — 各様式のdocx自動生成
- `reminders/zairyuKikanSchedule.js` — 在留期間満了リマインド（**可変期間の有効期限型。第四のリマインドパターン**）。在留期間が3月/1年/3年/5年と可変で許可日から一意に計算できないため、建設業許可・産廃許可と異なり「満了日そのもの」を`gijinkokuDetail.expiryDateIso`として直接入力に受け取る設計。更新申請の特例期間（満了後2ヶ月まで。出入国在留管理庁公式サイトで確認済み）を締切リマインドのラベルに明記
- `index.js` — `registerGijinkokuModule()`でコアの`scheduleTypes.js`へ登録するエントリポイント
- 所属機関カテゴリーの区分基準自体は法令ではなく行政上の運用要領に基づくため自動判定はせず、利用者の手入力を前提とする。情報処理技術の資格保有等による学歴/実務経験要件の免除規定（法務大臣告示）は一次資料で検証できないため対象外（`docs/REQUIREMENTS_gijinkoku-core.md` 4.5節・FR-G1.2）

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
- `reminders/caseDeadlines.js` — 案件の納期から`ReminderAlert`相当を生成。**あえて`registerScheduleFn`（許可のレジストリ）を使わない設計**: 案件を`LicenseEntry`として無理に扱うとコアが許可種別以外の概念を抱え込んでしまうため、表示用の関数（`bucketizeAlerts`等）だけをコアから再利用し、許可のリマインド一覧（`buildReminderDigest`）とは別コマンド・別出力として扱う（`docs/DESIGN_uketsuke-portal.md` 5章）
- `scripts/portal-*.js` — 元請・案件の登録/一覧/ステータス更新・納期リマインド表示のCLI
- Web一覧表示・オンライン決済・複数案件の月次請求サマリーは対象外（`docs/REQUIREMENTS_uketsuke-portal.md` 4.6節）

### Web・共通

- `src/web/server.js` — インテイク用の簡易Webフォーム（M3。建設業許可のみ対応）＋リマインド表示・残日数フィルタ（`/reminders`、M7）＋下書き保存（`/drafts`）＋CSVダウンロード（`/clients.csv`）。node:http のみで実装し、127.0.0.1のみで待受
- `src/web/draftStore.js` — インテイクフォームの入力途中データを `data/drafts.json` へ読み書きするローカル永続化層（DB不使用）
- `test/` — `node --test` で実行するユニットテスト（外部テストランナー不要）
- `scripts/` — 動作確認用のサンプル実行スクリプト（`sampleProfile.js`・`sampleKobutsuProfile.js`が各許可種別共通のダミーデータ）

## 既知の未実装・今後の拡張ポイント

- 正式な様式（国交省・都道府県指定のレイアウト）への完全準拠したPDF/docx出力
  （現状は内容確認用のサマリー表のみ）
- 様式第二十号の二（誓約書）は本ツールが判定に用いる欠格要件6項目のみを確認しており、
  建設業法第8条の全14号への完全対応はしていない
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
  整合性チェック（建設業許可の`consistencyChecks.js`相当）・法人申請対応
  （`docs/DESIGN_kobutsu-core.md` 9章「今後の拡張ポイント」参照）
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
